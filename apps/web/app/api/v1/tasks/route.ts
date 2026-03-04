import { NextRequest } from 'next/server';
import { CreateTaskSchema } from '@nexus-protocol/shared';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { forwardToAgent } from '@/lib/agent-forwarder';
import { checkTimeout } from '@/lib/task-timeout';
import { emitTrustEvent, getTaskCompletedScore, SCORE_TASK_FAILED, SCORE_SLA_BREACH } from '@/lib/trust-events';
import type { A2AMessage } from '@nexus-protocol/shared';

async function getSystemAgentId(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<string> {
  if (process.env['SYSTEM_AGENT_ID']) return process.env['SYSTEM_AGENT_ID'];
  const { data } = await supabase
    .from('agents')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();
  if (!data) throw new Error('No agents registered — cannot determine system agent');
  return data.id as string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = CreateTaskSchema.parse(body);
    const supabase = getSupabaseAdmin();

    // Validate assigned agent exists and is online
    const { data: agent, error: agentErr } = await supabase
      .from('agents')
      .select('id, endpoint, status')
      .eq('id', input.assignedAgentId)
      .single();

    if (agentErr || !agent) {
      return errorResponse(new Error(`Agent not found: ${input.assignedAgentId}`));
    }
    if (agent.status !== 'online') {
      return errorResponse(new Error(`Agent is not online: ${agent.status}`));
    }

    const requesterAgentId = await getSystemAgentId(supabase);
    const timeoutAt = new Date(Date.now() + input.timeoutSeconds * 1000).toISOString();

    // Insert task as assigned
    const { data: task, error: insertErr } = await supabase
      .from('tasks')
      .insert({
        title: input.title,
        description: input.description,
        status: 'assigned',
        requester_agent_id: requesterAgentId,
        assigned_agent_id: input.assignedAgentId,
        input: input.input,
        timeout_at: timeoutAt,
      })
      .select('*')
      .single();

    if (insertErr || !task) {
      return errorResponse(new Error(insertErr?.message ?? 'Failed to create task'));
    }

    // Build user message from input
    const userMessage: A2AMessage = {
      role: 'user',
      parts: [{ type: 'text', data: JSON.stringify(input.input) }],
    };

    // Forward to agent synchronously
    try {
      const result = await forwardToAgent(agent.endpoint as string, task.id as string, userMessage);

      const now = new Date().toISOString();
      await supabase
        .from('tasks')
        .update({
          status: result.status === 'completed' ? 'completed' : 'running',
          messages: result.messages ?? [],
          artifacts: result.artifacts ?? [],
          output: result.artifacts?.[0]?.parts?.[0]?.data
            ? { result: result.artifacts[0].parts[0].data }
            : null,
          completed_at: result.status === 'completed' ? now : null,
        })
        .eq('id', task.id);

      // Emit trust events
      const responseMs = Date.now() - new Date(task.created_at as string).getTime();
      const SLA_MS = 5 * 60 * 1000;

      if (result.status === 'completed') {
        await emitTrustEvent(supabase, {
          agentId: input.assignedAgentId,
          eventType: 'task_completed',
          score: getTaskCompletedScore(responseMs),
          reason: `Task completed in ${Math.round(responseMs / 1000)}s`,
          taskId: task.id as string,
        });
        if (responseMs > SLA_MS) {
          await emitTrustEvent(supabase, {
            agentId: input.assignedAgentId,
            eventType: 'sla_breach',
            score: SCORE_SLA_BREACH,
            reason: `Response time ${Math.round(responseMs / 1000)}s exceeded 5m SLA`,
            taskId: task.id as string,
          });
        }
      }

      // Re-fetch updated task
      const { data: updated } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', task.id)
        .single();

      return successResponse(updated ?? task, 201);
    } catch (fwdErr) {
      // Forward failed — mark task as failed
      const errMsg = fwdErr instanceof Error ? fwdErr.message : String(fwdErr);
      await supabase
        .from('tasks')
        .update({
          status: 'failed',
          error_message: errMsg,
          completed_at: new Date().toISOString(),
        })
        .eq('id', task.id);

      await emitTrustEvent(supabase, {
        agentId: input.assignedAgentId,
        eventType: 'task_failed',
        score: SCORE_TASK_FAILED,
        reason: `Task failed: ${errMsg}`,
        taskId: task.id as string,
      });

      const { data: failedTask } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', task.id)
        .single();

      return successResponse(failedTask ?? task, 201);
    }
  } catch (err) {
    return errorResponse(err);
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const assignedAgentId = url.searchParams.get('assignedAgentId');
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 100);
    const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);

    let query = supabase.from('tasks').select('*', { count: 'exact' });

    if (status) query = query.eq('status', status);
    if (assignedAgentId) query = query.eq('assigned_agent_id', assignedAgentId);

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data: tasks, count, error } = await query;

    if (error) return errorResponse(new Error(error.message));

    // Lazy timeout check
    if (tasks) {
      for (const task of tasks) {
        await checkTimeout(supabase, task);
      }
    }

    return successResponse({ tasks: tasks ?? [], total: count ?? 0, limit, offset });
  } catch (err) {
    return errorResponse(err);
  }
}
