import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { forwardToAgent } from '@/lib/agent-forwarder';
import type { A2AMessage } from '@nexus-protocol/shared';

// ── CORS headers ────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonRpcSuccess(id: string | number | null, result: unknown) {
  return NextResponse.json(
    { jsonrpc: '2.0', id, result },
    { headers: CORS_HEADERS },
  );
}

function jsonRpcError(id: string | number | null, code: number, message: string, data?: unknown) {
  return NextResponse.json(
    { jsonrpc: '2.0', id, error: { code, message, ...(data !== undefined && { data }) } },
    { headers: CORS_HEADERS },
  );
}

// ── Tool definitions ────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'register_agent',
    description: 'Register a new AI agent in the NEXUS marketplace. Returns the created agent record with its UUID.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Agent display name' },
        description: { type: 'string', description: 'What this agent does' },
        endpoint: { type: 'string', description: 'A2A-compatible endpoint URL' },
        skills: {
          type: 'array',
          description: 'Agent capabilities',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } },
            },
            required: ['id', 'name', 'description'],
          },
        },
        tags: { type: 'array', items: { type: 'string' }, description: 'Searchable tags' },
        pricePerTask: { type: 'number', description: 'Credit cost per task (default 0)' },
      },
      required: ['name', 'description', 'endpoint'],
    },
  },
  {
    name: 'discover_agents',
    description: 'Search and discover agents by capability, skill tags, status, or minimum trust score.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Free-text search across agent names and descriptions' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Filter by skill tags' },
        status: { type: 'string', enum: ['online', 'offline', 'degraded'], description: 'Filter by status' },
        minTrustScore: { type: 'number', description: 'Minimum trust score (0-100)' },
        limit: { type: 'number', description: 'Max results (default 20, max 100)' },
      },
    },
  },
  {
    name: 'get_agent_status',
    description: "Check an agent's trust score, availability, stats, and recent trust events.",
    inputSchema: {
      type: 'object' as const,
      properties: {
        agentId: { type: 'string', description: 'UUID of the agent' },
      },
      required: ['agentId'],
    },
  },
  {
    name: 'coordinate_task',
    description: 'Send a task to an agent and get results via A2A protocol. Creates a task, forwards it to the agent, and polls for completion.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        agentId: { type: 'string', description: 'UUID of the target agent' },
        title: { type: 'string', description: 'Short task title' },
        description: { type: 'string', description: 'Detailed task description' },
        input: { type: 'object', description: 'Input data for the agent' },
        timeoutSeconds: { type: 'number', description: 'Timeout in seconds (default 300, max 3600)' },
      },
      required: ['agentId', 'title', 'input'],
    },
  },
];

// ── Tool handlers ───────────────────────────────────────────────────────────

async function handleRegisterAgent(args: Record<string, unknown>) {
  const db = getSupabaseAdmin();

  const name = args.name as string;
  const description = args.description as string;
  const endpoint = args.endpoint as string;
  const skills = (args.skills as Array<Record<string, unknown>>) ?? [];
  const tags = (args.tags as string[]) ?? [];
  const pricePerTask = (args.pricePerTask as number) ?? 0;

  if (!name || !description || !endpoint) {
    return { content: [{ type: 'text', text: 'Missing required fields: name, description, endpoint' }], isError: true };
  }

  // Generate agent card
  const agentCard = {
    name,
    description,
    url: endpoint,
    version: '1.0.0',
    capabilities: { streaming: false, pushNotifications: false, stateTransitionHistory: false },
    skills: skills.map((s) => ({
      id: s.id ?? s.name,
      name: s.name,
      description: s.description ?? '',
      tags: s.tags ?? [],
      examples: [],
    })),
  };

  const { data: agent, error } = await db
    .from('agents')
    .insert({
      name,
      description,
      endpoint,
      status: 'online',
      skills,
      tags,
      trust_score: 50,
      price_per_task: pricePerTask,
      agent_card: agentCard,
      metadata: { trust_components: { reliability: 50, speed: 50, quality: 50, tenure: 0 } },
    })
    .select('id, name, status, trust_score, endpoint, created_at')
    .single();

  if (error) {
    return { content: [{ type: 'text', text: `Failed to register agent: ${error.message}` }], isError: true };
  }

  return {
    content: [{
      type: 'text',
      text: `Agent registered successfully.\n\n**ID**: ${agent.id}\n**Name**: ${agent.name}\n**Status**: ${agent.status}\n**Trust Score**: ${agent.trust_score}\n**Endpoint**: ${agent.endpoint}\n**Created**: ${agent.created_at}`,
    }],
  };
}

async function handleDiscoverAgents(args: Record<string, unknown>) {
  const db = getSupabaseAdmin();
  const maxResults = Math.min((args.limit as number) ?? 20, 100);

  let query = db.from('agents').select('id, name, description, status, trust_score, tags, skills');

  if (args.status) query = query.eq('status', args.status as string);
  if (args.minTrustScore !== undefined) query = query.gte('trust_score', args.minTrustScore as number);
  if (args.tags && Array.isArray(args.tags) && (args.tags as string[]).length > 0) {
    query = query.overlaps('tags', args.tags as string[]);
  }
  if (args.query) {
    const q = args.query as string;
    query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
  }

  query = query.order('trust_score', { ascending: false }).limit(maxResults);
  const { data: agents, error } = await query;

  if (error) {
    return { content: [{ type: 'text', text: `Error searching agents: ${error.message}` }], isError: true };
  }

  if (!agents || agents.length === 0) {
    return { content: [{ type: 'text', text: 'No agents found matching the criteria.' }] };
  }

  const lines = agents.map((a: Record<string, unknown>) => {
    const agentTags = Array.isArray(a.tags) ? (a.tags as string[]).join(', ') : '';
    const skillCount = Array.isArray(a.skills) ? (a.skills as unknown[]).length : 0;
    return `- **${a.name}** (\`${a.id}\`)\n  ${a.description}\n  Status: ${a.status} | Trust: ${a.trust_score} | Skills: ${skillCount} | Tags: ${agentTags}`;
  });

  return { content: [{ type: 'text', text: `Found ${agents.length} agent(s):\n\n${lines.join('\n\n')}` }] };
}

async function handleGetAgentStatus(args: Record<string, unknown>) {
  const db = getSupabaseAdmin();
  const agentId = args.agentId as string;

  if (!agentId) {
    return { content: [{ type: 'text', text: 'Missing required field: agentId' }], isError: true };
  }

  const { data: agent, error: agentErr } = await db
    .from('agents')
    .select('id, name, description, status, trust_score, endpoint, tags, skills, metadata, last_heartbeat, created_at')
    .eq('id', agentId)
    .single();

  if (agentErr || !agent) {
    return { content: [{ type: 'text', text: `Agent not found: ${agentId}` }], isError: true };
  }

  // Get task stats
  const { count: totalTasks } = await db
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('assigned_agent_id', agentId);

  const { count: completedTasks } = await db
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('assigned_agent_id', agentId)
    .eq('status', 'completed');

  const { count: failedTasks } = await db
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('assigned_agent_id', agentId)
    .eq('status', 'failed');

  // Get recent trust events
  const { data: events } = await db
    .from('trust_events')
    .select('event_type, score, reason, created_at')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(5);

  const metadata = agent.metadata as Record<string, unknown> | null;
  const trustComponents = metadata?.trust_components as Record<string, number> | undefined;
  const skillCount = Array.isArray(agent.skills) ? (agent.skills as unknown[]).length : 0;

  const lines = [
    `**${agent.name}** (\`${agent.id}\`)`,
    `${agent.description}`,
    '',
    `**Status**: ${agent.status}`,
    `**Trust Score**: ${agent.trust_score}/100`,
    ...(trustComponents ? [
      `  - Reliability: ${trustComponents.reliability}`,
      `  - Speed: ${trustComponents.speed}`,
      `  - Quality: ${trustComponents.quality}`,
      `  - Tenure: ${trustComponents.tenure}`,
    ] : []),
    `**Endpoint**: ${agent.endpoint}`,
    `**Skills**: ${skillCount}`,
    `**Tags**: ${Array.isArray(agent.tags) ? (agent.tags as string[]).join(', ') : 'none'}`,
    '',
    `**Task Stats**: ${totalTasks ?? 0} total | ${completedTasks ?? 0} completed | ${failedTasks ?? 0} failed`,
    `**Last Heartbeat**: ${agent.last_heartbeat ?? 'never'}`,
    `**Registered**: ${agent.created_at}`,
  ];

  if (events && events.length > 0) {
    lines.push('', '**Recent Trust Events**:');
    for (const e of events) {
      lines.push(`  - ${e.event_type} (${e.score > 0 ? '+' : ''}${e.score}) — ${e.reason || 'no reason'} — ${e.created_at}`);
    }
  }

  return { content: [{ type: 'text', text: lines.join('\n') }] };
}

async function handleCoordinateTask(args: Record<string, unknown>) {
  const db = getSupabaseAdmin();
  const agentId = args.agentId as string;
  const title = args.title as string;
  const description = (args.description as string) ?? '';
  const input = (args.input as Record<string, unknown>) ?? {};
  const timeout = Math.min(Math.max((args.timeoutSeconds as number) ?? 300, 10), 3600);

  if (!agentId || !title) {
    return { content: [{ type: 'text', text: 'Missing required fields: agentId, title' }], isError: true };
  }

  // Validate agent
  const { data: agent, error: agentErr } = await db
    .from('agents')
    .select('id, endpoint, status, name')
    .eq('id', agentId)
    .single();

  if (agentErr || !agent) {
    return { content: [{ type: 'text', text: `Agent not found: ${agentId}` }], isError: true };
  }
  if ((agent.status as string) !== 'online') {
    return { content: [{ type: 'text', text: `Agent "${agent.name}" is not online (status: ${agent.status})` }], isError: true };
  }

  // Find system agent for requester
  let requesterAgentId: string;
  if (process.env['SYSTEM_AGENT_ID']) {
    requesterAgentId = process.env['SYSTEM_AGENT_ID'];
  } else {
    const { data: firstAgent } = await db
      .from('agents')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();
    if (!firstAgent) {
      return { content: [{ type: 'text', text: 'No system agent available — register at least one agent first' }], isError: true };
    }
    requesterAgentId = firstAgent.id as string;
  }

  const timeoutAt = new Date(Date.now() + timeout * 1000).toISOString();

  // Create task
  const { data: task, error: insertErr } = await db
    .from('tasks')
    .insert({
      title,
      description,
      status: 'assigned',
      requester_agent_id: requesterAgentId,
      assigned_agent_id: agentId,
      input,
      timeout_at: timeoutAt,
    })
    .select('id')
    .single();

  if (insertErr || !task) {
    return { content: [{ type: 'text', text: `Failed to create task: ${insertErr?.message ?? 'unknown error'}` }], isError: true };
  }

  const taskId = task.id as string;

  // Forward to agent via A2A
  const userMessage: A2AMessage = {
    role: 'user',
    parts: [{ type: 'text', data: JSON.stringify(input) }],
  };

  // Fire-and-forget forwarding
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

  // Poll for completion
  const POLL_INTERVAL_MS = 2000;
  const deadline = Date.now() + timeout * 1000;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const { data: polled } = await db
      .from('tasks')
      .select('status, artifacts, error_message, output')
      .eq('id', taskId)
      .single();

    if (!polled) break;

    const status = polled.status as string;
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      if (status !== 'completed') {
        return {
          content: [{
            type: 'text',
            text: `Task ${taskId} — ${status}: ${polled.error_message ?? 'unknown error'}`,
          }],
          isError: true,
        };
      }

      const output = polled.output ? JSON.stringify(polled.output).slice(0, 1000) : '(no output)';
      return {
        content: [{
          type: 'text',
          text: `Task ${taskId} — completed successfully.\n\n**Agent**: ${agent.name}\n**Output**: ${output}`,
        }],
      };
    }
  }

  return {
    content: [{
      type: 'text',
      text: `Task ${taskId} — still running after ${timeout}s. Use get_agent_status or poll the task API at /api/v1/tasks/${taskId} for updates.`,
    }],
  };
}

// ── Tool dispatcher ─────────────────────────────────────────────────────────

const TOOL_HANDLERS: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
  register_agent: handleRegisterAgent,
  discover_agents: handleDiscoverAgents,
  get_agent_status: handleGetAgentStatus,
  coordinate_task: handleCoordinateTask,
};

// ── Route handlers ──────────────────────────────────────────────────────────

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  return NextResponse.json(
    {
      name: 'nexus-protocol',
      version: '0.1.0',
      description: 'NEXUS Agent Economy Protocol — MCP endpoint for agent coordination, discovery, and task delegation via A2A.',
      protocol: 'MCP (Model Context Protocol)',
      transport: 'JSON-RPC 2.0 over HTTP POST',
      tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
      endpoints: {
        mcp: '/mcp (POST — JSON-RPC 2.0)',
        api: '/api/v1 (REST API)',
        a2a: '/api/v1/a2a (A2A JSON-RPC gateway)',
        agentCard: '/.well-known/agent.json',
      },
    },
    { headers: CORS_HEADERS },
  );
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonRpcError(null, -32700, 'Parse error: invalid JSON');
  }

  const { jsonrpc, id, method, params } = body as {
    jsonrpc: string;
    id: string | number | null;
    method: string;
    params?: unknown;
  };

  if (jsonrpc !== '2.0') {
    return jsonRpcError(id ?? null, -32600, 'Invalid Request: jsonrpc must be "2.0"');
  }

  if (!method || typeof method !== 'string') {
    return jsonRpcError(id ?? null, -32600, 'Invalid Request: missing method');
  }

  try {
    switch (method) {
      case 'initialize': {
        return jsonRpcSuccess(id, {
          protocolVersion: '2024-11-05',
          serverInfo: { name: 'nexus-protocol', version: '0.1.0' },
          capabilities: { tools: {} },
        });
      }

      case 'tools/list': {
        return jsonRpcSuccess(id, { tools: TOOLS });
      }

      case 'tools/call': {
        const p = params as { name: string; arguments?: Record<string, unknown> } | undefined;
        if (!p?.name) {
          return jsonRpcError(id, -32602, 'Invalid params: missing tool name');
        }

        const handler = TOOL_HANDLERS[p.name];
        if (!handler) {
          return jsonRpcError(id, -32602, `Unknown tool: ${p.name}`);
        }

        const result = await handler(p.arguments ?? {});
        return jsonRpcSuccess(id, result);
      }

      case 'notifications/initialized':
      case 'ping': {
        return jsonRpcSuccess(id, {});
      }

      default: {
        return jsonRpcError(id, -32601, `Method not found: ${method}`);
      }
    }
  } catch (err) {
    console.error(`MCP error [${method}]:`, err);
    const message = err instanceof Error ? err.message : 'Internal error';
    return jsonRpcError(id, -32603, message);
  }
}
