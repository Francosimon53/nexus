import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { AgentEndpointError } from '@nexus-protocol/shared';
import type { A2AMessage } from '@nexus-protocol/shared';
import { getDb } from './db.js';

// ── Agent forwarder (ported from apps/web/lib/agent-forwarder.ts) ────────────

interface A2ATaskResponse {
  id: string;
  status: string;
  messages: Array<{ role: string; parts: Array<{ type: string; data: unknown }> }>;
  artifacts: Array<{ parts: Array<{ type: string; data: unknown }>; name?: string; description?: string }>;
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function forwardToAgent(
  endpoint: string,
  taskId: string,
  message: A2AMessage,
): Promise<A2ATaskResponse> {
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: taskId,
    method: 'message/send',
    params: { id: taskId, message },
  });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(BASE_DELAY_MS * Math.pow(2, attempt - 1));
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status}: ${res.statusText}`);
        continue;
      }

      const json = (await res.json()) as {
        result?: A2ATaskResponse;
        error?: { code: number; message: string };
      };

      if (json.error) {
        lastError = new Error(`JSON-RPC error ${json.error.code}: ${json.error.message}`);
        continue;
      }

      if (!json.result) {
        lastError = new Error('Empty result from agent');
        continue;
      }

      return json.result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw new AgentEndpointError(endpoint, lastError?.message);
}

// ── Timeout check (ported from apps/web/lib/task-timeout.ts) ─────────────────

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);

interface TaskRow {
  id: string;
  status: string;
  timeout_at: string | null;
  [key: string]: unknown;
}

async function checkTimeout(task: TaskRow): Promise<boolean> {
  if (!task.timeout_at) return false;
  if (TERMINAL_STATUSES.has(task.status)) return false;
  if (new Date(task.timeout_at) > new Date()) return false;

  const db = getDb();
  await db
    .from('tasks')
    .update({
      status: 'failed',
      error_message: 'Task timed out',
      completed_at: new Date().toISOString(),
    })
    .eq('id', task.id);

  task.status = 'failed';
  return true;
}

// ── System agent ID helper ───────────────────────────────────────────────────

async function getSystemAgentId(): Promise<string> {
  if (process.env['SYSTEM_AGENT_ID']) return process.env['SYSTEM_AGENT_ID'];
  const db = getDb();
  const { data } = await db
    .from('agents')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();
  if (!data) throw new Error('No agents registered — cannot determine system agent');
  return data.id as string;
}

// ── MCP Server factory ──────────────────────────────────────────────────────

export function createNexusMcpServer(): McpServer {
  const server = new McpServer(
    { name: 'nexus', version: '0.1.0' },
    { capabilities: { resources: {}, tools: {} } },
  );

  // ── Tool: discover_agents ───────────────────────────────────────────────

  server.tool(
    'discover_agents',
    'Discover agents registered in the NEXUS network. Filter by skill tags, status, or minimum trust score.',
    {
      skillTags: z.string().optional().describe('Comma-separated skill tags to filter by (e.g. "text,summarize")'),
      status: z.string().optional().describe('Agent status filter: online, offline, or degraded'),
      minTrustScore: z.number().optional().describe('Minimum trust score (0-100)'),
      limit: z.number().optional().describe('Max number of results (default 20)'),
    },
    async ({ skillTags, status, minTrustScore, limit }) => {
      const db = getDb();
      const maxResults = Math.min(limit ?? 20, 100);

      let query = db.from('agents').select('id, name, status, trust_score, tags, skills, description');

      if (status) query = query.eq('status', status);
      if (minTrustScore !== undefined) query = query.gte('trust_score', minTrustScore);
      if (skillTags) {
        const tags = skillTags.split(',').map((t) => t.trim());
        query = query.overlaps('tags', tags);
      }

      query = query.order('trust_score', { ascending: false }).limit(maxResults);
      const { data: agents, error } = await query;

      if (error) {
        return { content: [{ type: 'text' as const, text: `Error querying agents: ${error.message}` }], isError: true };
      }

      if (!agents || agents.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No agents found matching the criteria.' }] };
      }

      const lines = agents.map((a: Record<string, unknown>) => {
        const tags = Array.isArray(a.tags) ? (a.tags as string[]).join(', ') : '';
        const skillCount = Array.isArray(a.skills) ? (a.skills as unknown[]).length : 0;
        return `- **${a.name}** (${a.id})\n  Status: ${a.status} | Trust: ${a.trust_score} | Skills: ${skillCount} | Tags: ${tags}`;
      });

      return { content: [{ type: 'text' as const, text: `Found ${agents.length} agent(s):\n\n${lines.join('\n')}` }] };
    },
  );

  // ── Tool: delegate_task ─────────────────────────────────────────────────

  server.tool(
    'delegate_task',
    'Delegate a task to a specific NEXUS agent. The agent will be contacted via A2A protocol and the result returned.',
    {
      agentId: z.string().describe('UUID of the agent to delegate to'),
      title: z.string().describe('Short title for the task'),
      description: z.string().optional().describe('Longer description of the task'),
      input: z.record(z.unknown()).describe('Input data object for the agent'),
      timeoutSeconds: z.number().optional().describe('Timeout in seconds (default 300, max 3600)'),
    },
    async ({ agentId, title, description, input, timeoutSeconds }) => {
      const db = getDb();
      const timeout = Math.min(Math.max(timeoutSeconds ?? 300, 10), 3600);

      // Validate agent
      const { data: agent, error: agentErr } = await db
        .from('agents')
        .select('id, endpoint, status')
        .eq('id', agentId)
        .single();

      if (agentErr || !agent) {
        return { content: [{ type: 'text' as const, text: `Agent not found: ${agentId}` }], isError: true };
      }
      if ((agent.status as string) !== 'online') {
        return { content: [{ type: 'text' as const, text: `Agent is not online (status: ${agent.status})` }], isError: true };
      }

      const requesterAgentId = await getSystemAgentId();
      const timeoutAt = new Date(Date.now() + timeout * 1000).toISOString();

      // Create task
      const { data: task, error: insertErr } = await db
        .from('tasks')
        .insert({
          title,
          description: description ?? '',
          status: 'assigned',
          requester_agent_id: requesterAgentId,
          assigned_agent_id: agentId,
          input,
          timeout_at: timeoutAt,
        })
        .select('*')
        .single();

      if (insertErr || !task) {
        return { content: [{ type: 'text' as const, text: `Failed to create task: ${insertErr?.message ?? 'unknown error'}` }], isError: true };
      }

      const taskId = task.id as string;

      // Forward to agent asynchronously — don't block the MCP tool call
      const userMessage: A2AMessage = {
        role: 'user',
        parts: [{ type: 'text', data: JSON.stringify(input) }],
      };

      // Fire-and-forget: forward to agent and update task on completion
      forwardToAgent(agent.endpoint as string, taskId, userMessage)
        .then(async (result) => {
          await db
            .from('tasks')
            .update({
              status: result.status === 'completed' ? 'completed' : 'running',
              messages: result.messages ?? [],
              artifacts: result.artifacts ?? [],
              output: result.artifacts?.[0]?.parts?.[0]?.data
                ? { result: result.artifacts[0].parts[0].data }
                : null,
              completed_at: result.status === 'completed' ? new Date().toISOString() : null,
            })
            .eq('id', taskId);
        })
        .catch(async (fwdErr) => {
          const errMsg = fwdErr instanceof Error ? fwdErr.message : String(fwdErr);
          await db
            .from('tasks')
            .update({
              status: 'failed',
              error_message: errMsg,
              completed_at: new Date().toISOString(),
            })
            .eq('id', taskId);
        });

      // Poll for completion instead of blocking on the forward call
      const POLL_INTERVAL_MS = 2000;
      const deadline = Date.now() + timeout * 1000;

      while (Date.now() < deadline) {
        await sleep(POLL_INTERVAL_MS);

        const { data: polled } = await db
          .from('tasks')
          .select('status, artifacts, error_message')
          .eq('id', taskId)
          .single();

        if (!polled) break;

        const status = polled.status as string;
        if (status === 'completed' || status === 'failed' || status === 'timed_out') {
          if (status === 'failed' || status === 'timed_out') {
            return {
              content: [{ type: 'text' as const, text: `Task ${taskId} — ${status}: ${polled.error_message ?? 'unknown error'}` }],
              isError: true,
            };
          }

          const artifacts = Array.isArray(polled.artifacts) ? polled.artifacts as Array<Record<string, unknown>> : [];
          const parts = Array.isArray(artifacts[0]?.['parts']) ? artifacts[0]['parts'] as Array<Record<string, unknown>> : [];
          const outputSummary = parts[0]?.['data']
            ? JSON.stringify(parts[0]['data']).slice(0, 500)
            : '(no output)';

          return {
            content: [{ type: 'text' as const, text: `Task ${taskId} — completed\n\nOutput: ${outputSummary}` }],
          };
        }
      }

      // Timeout — task is still running, return the ID so the user can check later
      return {
        content: [{ type: 'text' as const, text: `Task ${taskId} — still running after ${timeout}s. Use check_task_status to poll for the result.` }],
      };
    },
  );

  // ── Tool: check_task_status ─────────────────────────────────────────────

  server.tool(
    'check_task_status',
    'Check the status of a previously delegated task.',
    {
      taskId: z.string().describe('UUID of the task to check'),
    },
    async ({ taskId }) => {
      const db = getDb();
      const { data: task, error } = await db
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (error || !task) {
        return { content: [{ type: 'text' as const, text: `Task not found: ${taskId}` }], isError: true };
      }

      // Lazy timeout check
      await checkTimeout(task as TaskRow);

      const messages = Array.isArray(task.messages) ? task.messages as Array<Record<string, unknown>> : [];
      const artifacts = Array.isArray(task.artifacts) ? task.artifacts as Array<Record<string, unknown>> : [];

      const lines = [
        `**Task**: ${task.id}`,
        `**Title**: ${task.title}`,
        `**Status**: ${task.status}`,
        `**Assigned to**: ${task.assigned_agent_id}`,
        `**Created**: ${task.created_at}`,
      ];

      if (task.error_message) lines.push(`**Error**: ${task.error_message}`);
      if (task.completed_at) lines.push(`**Completed**: ${task.completed_at}`);
      if (messages.length > 0) lines.push(`**Messages**: ${messages.length}`);
      if (artifacts.length > 0) {
        lines.push(`**Artifacts**: ${artifacts.length}`);
        const firstArtifact = artifacts[0];
        const parts = Array.isArray(firstArtifact?.['parts']) ? firstArtifact['parts'] as Array<Record<string, unknown>> : [];
        if (parts[0]?.['data']) {
          lines.push(`**Output preview**: ${JSON.stringify(parts[0]['data']).slice(0, 500)}`);
        }
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    },
  );

  // ── Tool: get_agent_trust ───────────────────────────────────────────────

  server.tool(
    'get_agent_trust',
    'Get the trust score and recent trust events for an agent.',
    {
      agentId: z.string().describe('UUID of the agent'),
    },
    async ({ agentId }) => {
      const db = getDb();

      const { data: agent, error: agentErr } = await db
        .from('agents')
        .select('id, name, trust_score')
        .eq('id', agentId)
        .single();

      if (agentErr || !agent) {
        return { content: [{ type: 'text' as const, text: `Agent not found: ${agentId}` }], isError: true };
      }

      const { data: events } = await db
        .from('trust_events')
        .select('event_type, score, reason, created_at')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false })
        .limit(10);

      const lines = [
        `**Agent**: ${agent.name} (${agent.id})`,
        `**Trust Score**: ${agent.trust_score}`,
        '',
        '**Recent Trust Events**:',
      ];

      if (events && events.length > 0) {
        for (const e of events) {
          lines.push(`- ${e.event_type} (${e.score > 0 ? '+' : ''}${e.score}) — ${e.reason || 'no reason'} — ${e.created_at}`);
        }
      } else {
        lines.push('No trust events recorded.');
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    },
  );

  // ── Resource: nexus://agents ────────────────────────────────────────────

  server.resource(
    'agents-list',
    'nexus://agents',
    { description: 'List all online agents in the NEXUS network', mimeType: 'application/json' },
    async () => {
      const db = getDb();
      const { data: agents, error } = await db
        .from('agents')
        .select('id, name, status, trust_score, tags, skills, description')
        .eq('status', 'online')
        .order('trust_score', { ascending: false });

      if (error) {
        return { contents: [{ uri: 'nexus://agents', text: JSON.stringify({ error: error.message }), mimeType: 'application/json' }] };
      }

      const result = (agents ?? []).map((a: Record<string, unknown>) => ({
        id: a.id,
        name: a.name,
        status: a.status,
        trustScore: a.trust_score,
        tags: a.tags,
        skillCount: Array.isArray(a.skills) ? (a.skills as unknown[]).length : 0,
        description: a.description,
      }));

      return { contents: [{ uri: 'nexus://agents', text: JSON.stringify(result, null, 2), mimeType: 'application/json' }] };
    },
  );

  // ── Resource: nexus://agents/{id} ───────────────────────────────────────

  server.resource(
    'agent-detail',
    new ResourceTemplate('nexus://agents/{id}', { list: undefined }),
    { description: 'Get full details for a specific agent', mimeType: 'application/json' },
    async (uri, params) => {
      const agentId = params.id as string;
      const db = getDb();
      const { data: agent, error } = await db
        .from('agents')
        .select('*')
        .eq('id', agentId)
        .single();

      if (error || !agent) {
        return { contents: [{ uri: uri.href, text: JSON.stringify({ error: `Agent not found: ${agentId}` }), mimeType: 'application/json' }] };
      }

      return { contents: [{ uri: uri.href, text: JSON.stringify(agent, null, 2), mimeType: 'application/json' }] };
    },
  );

  return server;
}
