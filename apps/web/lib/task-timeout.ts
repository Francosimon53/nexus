import type { SupabaseClient } from '@supabase/supabase-js';
import { isTerminal } from './task-status';
import type { TaskStatus } from '@nexus-protocol/shared';

interface TaskRow {
  id: string;
  status: string;
  timeout_at: string | null;
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

  task.status = 'failed';
  task.error_message = 'Task timed out';

  return { timedOut: true };
}
