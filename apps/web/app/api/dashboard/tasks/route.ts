import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { requireApiUser } from '@/lib/api-auth';
import { forwardToAgent } from '@/lib/agent-forwarder';
import { emitTrustEvent, getTaskCompletedScore, SCORE_TASK_FAILED, SCORE_SLA_BREACH } from '@/lib/trust-events';
import { getBalance, settleTask } from '@/lib/billing';
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

    // Find a requester agent ID for this user (or use system agent)
    const { data: userAgent } = await supabase
      .from('agents')
      .select('id')
      .eq('owner_user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    const requesterAgentId = userAgent?.id as string ?? agentId;

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

    // Forward to agent
    const userMessage: A2AMessage = {
      role: 'user',
      parts: [{ type: 'text', data: JSON.stringify({ text: message }) }],
    };

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

      // Trust events
      const responseMs = Date.now() - new Date(task.created_at as string).getTime();
      const SLA_MS = 5 * 60 * 1000;

      if (result.status === 'completed') {
        await emitTrustEvent(supabase, {
          agentId,
          eventType: 'task_completed',
          score: getTaskCompletedScore(responseMs),
          reason: `Task completed in ${Math.round(responseMs / 1000)}s`,
          taskId: task.id as string,
        });

        if (responseMs > SLA_MS) {
          await emitTrustEvent(supabase, {
            agentId,
            eventType: 'sla_breach',
            score: SCORE_SLA_BREACH,
            reason: `Response time ${Math.round(responseMs / 1000)}s exceeded 5m SLA`,
            taskId: task.id as string,
          });
        }

        // Settle billing
        if (cost > 0) {
          try {
            await settleTask(supabase, task.id as string, requesterAgentId, agentId, cost);
          } catch (billingErr) {
            console.error('Billing settlement failed (non-fatal):', billingErr);
          }
        }
      }

      return successResponse({ taskId: task.id }, 201);
    } catch (fwdErr) {
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
        agentId,
        eventType: 'task_failed',
        score: SCORE_TASK_FAILED,
        reason: `Task failed: ${errMsg}`,
        taskId: task.id as string,
      });

      return successResponse({ taskId: task.id }, 201);
    }
  } catch (err) {
    return errorResponse(err);
  }
}
