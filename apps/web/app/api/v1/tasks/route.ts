import { NextRequest } from 'next/server';
import { CreateTaskSchema } from '@nexus-protocol/shared';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { checkTimeout } from '@/lib/task-timeout';
import { processTaskAsync } from '@/lib/task-processor';
import { applyRateLimit } from '@/lib/rate-limit';
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
  // 30 task creations per minute per IP
  const limited = applyRateLimit(request, 'tasks:create', 30, 60_000);
  if (limited) return limited;

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

    // Get agent price for billing settlement
    const price = Number(
      (await supabase.from('agents').select('price_per_task').eq('id', input.assignedAgentId).single())
        .data?.price_per_task ?? 0,
    );

    // Process task asynchronously (forward to agent, settle billing, emit trust events)
    processTaskAsync({
      supabase,
      taskId: task.id as string,
      taskCreatedAt: task.created_at as string,
      agentEndpoint: agent.endpoint as string,
      assignedAgentId: input.assignedAgentId,
      requesterAgentId,
      message: userMessage,
      cost: price,
    });

    // Return immediately — clients should poll GET /tasks/:id or use SSE /tasks/:id/stream
    return successResponse(task, 202);
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
