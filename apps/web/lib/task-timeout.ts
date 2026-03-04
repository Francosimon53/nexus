import type { SupabaseClient } from '@supabase/supabase-js';
import { isTerminal } from './task-status';
import { emitTrustEvent, SCORE_TASK_TIMEOUT } from './trust-events';
import type { TaskStatus } from '@nexus-protocol/shared';

interface TaskRow {
  id: string;
  status: string;
  timeout_at: string | null;
  assigned_agent_id?: string;
  [key: string]: unknown;
}

export async function checkTimeout(
  supabase: SupabaseClient,
  task: TaskRow,
): Promise<{ timedOut: boolean }> {
  if (!task.timeout_at) return { timedOut: false };
  if (isTerminal(task.status as TaskStatus)) return { timedOut: false };
  if (new Date(task.timeout_at) > new Date()) return { timedOut: false };

  await supabase
    .from('tasks')
    .update({
      status: 'failed',
      error_message: 'Task timed out',
      completed_at: new Date().toISOString(),
    })
    .eq('id', task.id);

  // Emit trust event for timeout
  if (task.assigned_agent_id) {
    await emitTrustEvent(supabase, {
      agentId: task.assigned_agent_id,
      eventType: 'task_timeout',
      score: SCORE_TASK_TIMEOUT,
      reason: 'Task exceeded timeout deadline',
      taskId: task.id,
    });
  }

  task.status = 'failed';
  task.error_message = 'Task timed out';

  return { timedOut: true };
}
