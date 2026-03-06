import type { SupabaseClient } from '@supabase/supabase-js';
import type { A2AMessage } from '@nexus-protocol/shared';
import { forwardToAgent } from './agent-forwarder';
import { emitTrustEvent, getTaskCompletedScore, SCORE_TASK_FAILED, SCORE_SLA_BREACH } from './trust-events';
import { settleTask } from './billing';

const SLA_MS = 5 * 60 * 1000;

interface ProcessTaskParams {
  supabase: SupabaseClient;
  taskId: string;
  taskCreatedAt: string;
  agentEndpoint: string;
  assignedAgentId: string;
  requesterAgentId: string;
  message: A2AMessage;
  cost: number;
}

export function processTaskAsync(params: ProcessTaskParams): void {
  processTask(params).catch((err) => {
    console.error(`[task-processor] Unhandled error for task ${params.taskId}:`, err);
  });
}

async function processTask(params: ProcessTaskParams): Promise<void> {
  const { supabase, taskId, taskCreatedAt, agentEndpoint, assignedAgentId, requesterAgentId, message, cost } = params;

  try {
    const result = await forwardToAgent(agentEndpoint, taskId, message);

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
      .eq('id', taskId);

    const responseMs = Date.now() - new Date(taskCreatedAt).getTime();

    if (result.status === 'completed') {
      await emitTrustEvent(supabase, {
        agentId: assignedAgentId,
        eventType: 'task_completed',
        score: getTaskCompletedScore(responseMs),
        reason: `Task completed in ${Math.round(responseMs / 1000)}s`,
        taskId,
      });

      if (responseMs > SLA_MS) {
        await emitTrustEvent(supabase, {
          agentId: assignedAgentId,
          eventType: 'sla_breach',
          score: SCORE_SLA_BREACH,
          reason: `Response time ${Math.round(responseMs / 1000)}s exceeded 5m SLA`,
          taskId,
        });
      }

      if (cost > 0) {
        try {
          await settleTask(supabase, taskId, requesterAgentId, assignedAgentId, cost);
        } catch (billingErr) {
          console.error(`[task-processor] Billing settlement failed for task ${taskId}:`, billingErr);
        }
      }
    }
  } catch (fwdErr) {
    const errMsg = fwdErr instanceof Error ? fwdErr.message : String(fwdErr);
    await supabase
      .from('tasks')
      .update({
        status: 'failed',
        error_message: errMsg,
        completed_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    await emitTrustEvent(supabase, {
      agentId: assignedAgentId,
      eventType: 'task_failed',
      score: SCORE_TASK_FAILED,
      reason: `Task failed: ${errMsg}`,
      taskId,
    });
  }
}
