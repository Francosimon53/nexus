import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { requireApiUser } from '@/lib/api-auth';
import { getBalance } from '@/lib/billing';
import { processTaskAsync } from '@/lib/task-processor';
import type { A2AMessage } from '@nexus-protocol/shared';

const DashboardCreateTaskSchema = z.object({
  agentId: z.string().uuid(),
  message: z.string().min(1).max(10000),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await requireApiUser();
    const body = await request.json();
    const { agentId, message } = DashboardCreateTaskSchema.parse(body);
    const supabase = getSupabaseAdmin();

    // Fetch agent
    const { data: agent, error: agentErr } = await supabase
      .from('agents')
      .select('id, name, endpoint, status, price_per_task, owner_user_id')
      .eq('id', agentId)
      .single();

    if (agentErr || !agent) {
      return errorResponse(new Error('Agent not found'));
    }
    if (agent.status !== 'online') {
      return errorResponse(new Error(`Agent is not online (${agent.status})`));
    }

    const cost = Number(agent.price_per_task) || 0;

    // Check credits before creating task
    if (cost > 0) {
      const balance = await getBalance(supabase, userId);
      if (balance.balance < cost) {
        return successResponse(
          { error: 'INSUFFICIENT_CREDITS', balance: Number(balance.balance), cost },
          402,
        );
      }
    }

    // Find a requester agent ID: prefer user's own agent, fall back to system agent
    const { data: userAgent } = await supabase
      .from('agents')
      .select('id')
      .eq('owner_user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    let requesterAgentId = userAgent?.id as string | undefined;
    if (!requesterAgentId) {
      // User doesn't own any agents — use system agent as requester
      if (process.env['SYSTEM_AGENT_ID']) {
        requesterAgentId = process.env['SYSTEM_AGENT_ID'];
      } else {
        const { data: firstAgent } = await supabase
          .from('agents')
          .select('id')
          .neq('id', agentId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        requesterAgentId = (firstAgent?.id as string) ?? agentId;
      }
    }

    // Create task
    const title = `Task for ${agent.name as string}`;
    const timeoutAt = new Date(Date.now() + 300_000).toISOString();

    const { data: task, error: insertErr } = await supabase
      .from('tasks')
      .insert({
        title,
        description: message.slice(0, 200),
        status: 'assigned',
        requester_agent_id: requesterAgentId,
        assigned_agent_id: agentId,
        input: { text: message },
        timeout_at: timeoutAt,
        max_budget_credits: cost,
      })
      .select('*')
      .single();

    if (insertErr || !task) {
      return errorResponse(new Error(insertErr?.message ?? 'Failed to create task'));
    }

    // Forward to agent asynchronously
    const userMessage: A2AMessage = {
      role: 'user',
      parts: [{ type: 'text', data: JSON.stringify({ text: message }) }],
    };

    processTaskAsync({
      supabase,
      taskId: task.id as string,
      taskCreatedAt: task.created_at as string,
      agentEndpoint: agent.endpoint as string,
      assignedAgentId: agentId,
      requesterAgentId,
      message: userMessage,
      cost,
    });

    // Return immediately — frontend should poll or use SSE for updates
    return successResponse({ taskId: task.id }, 202);
  } catch (err) {
    return errorResponse(err);
  }
}
