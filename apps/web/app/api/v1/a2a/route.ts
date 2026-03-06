import { NextRequest, NextResponse } from 'next/server';
import { JsonRpcRequestSchema, CreateTaskSchema } from '@nexus-protocol/shared';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { checkTimeout } from '@/lib/task-timeout';
import { processTaskAsync } from '@/lib/task-processor';
import type { A2AMessage } from '@nexus-protocol/shared';

function rpcError(id: string | number | null, code: number, message: string) {
  return NextResponse.json({ jsonrpc: '2.0', id, error: { code, message } });
}

function rpcResult(id: string | number, result: unknown) {
  return NextResponse.json({ jsonrpc: '2.0', id, result });
}

async function getSystemAgentId(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<string> {
  if (process.env['SYSTEM_AGENT_ID']) return process.env['SYSTEM_AGENT_ID'];
  const { data } = await supabase
    .from('agents')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();
  if (!data) throw new Error('No agents registered');
  return data.id as string;
}

export async function POST(request: NextRequest) {
  let rpcId: string | number | null = null;

  try {
    const body = await request.json();
    const rpc = JsonRpcRequestSchema.parse(body);
    rpcId = rpc.id;
    const params = rpc.params ?? {};
    const supabase = getSupabaseAdmin();

    switch (rpc.method) {
      case 'message/send': {
        const taskInput = CreateTaskSchema.parse(params);

        const { data: agent } = await supabase
          .from('agents')
          .select('id, endpoint, status, price_per_task')
          .eq('id', taskInput.assignedAgentId)
          .single();

        if (!agent) return rpcError(rpc.id, -32602, `Agent not found: ${taskInput.assignedAgentId}`);
        if (agent.status !== 'online') return rpcError(rpc.id, -32602, `Agent is not online: ${agent.status}`);

        const requesterAgentId = await getSystemAgentId(supabase);
        const timeoutAt = new Date(Date.now() + taskInput.timeoutSeconds * 1000).toISOString();

        const { data: task, error: insertErr } = await supabase
          .from('tasks')
          .insert({
            title: taskInput.title,
            description: taskInput.description,
            status: 'assigned',
            requester_agent_id: requesterAgentId,
            assigned_agent_id: taskInput.assignedAgentId,
            input: taskInput.input,
            timeout_at: timeoutAt,
          })
          .select('*')
          .single();

        if (insertErr || !task) return rpcError(rpc.id, -32000, insertErr?.message ?? 'Failed to create task');

        const userMessage: A2AMessage = {
          role: 'user',
          parts: [{ type: 'text', data: JSON.stringify(taskInput.input) }],
        };

        // Process asynchronously — same as POST /v1/tasks
        processTaskAsync({
          supabase,
          taskId: task.id as string,
          taskCreatedAt: task.created_at as string,
          agentEndpoint: agent.endpoint as string,
          assignedAgentId: taskInput.assignedAgentId,
          requesterAgentId,
          message: userMessage,
          cost: Number(agent.price_per_task ?? 0),
        });

        return rpcResult(rpc.id, task);
      }

      case 'tasks/get': {
        const taskId = params['id'] as string | undefined;
        if (!taskId) return rpcError(rpc.id, -32602, 'Missing param: id');

        const { data: task } = await supabase.from('tasks').select('*').eq('id', taskId).single();
        if (!task) return rpcError(rpc.id, -32602, `Task not found: ${taskId}`);

        await checkTimeout(supabase, task);
        return rpcResult(rpc.id, task);
      }

      default:
        return rpcError(rpc.id, -32601, `Method not found: ${rpc.method}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    return rpcError(rpcId, -32000, msg);
  }
}
