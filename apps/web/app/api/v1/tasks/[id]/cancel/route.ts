import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { isTerminal } from '@/lib/task-status';
import { TaskNotFoundError, ValidationError } from '@nexus-protocol/shared';
import type { TaskStatus } from '@nexus-protocol/shared';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) return errorResponse(new ValidationError('Invalid task ID'));

    const supabase = getSupabaseAdmin();
    const { data: task, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !task) return errorResponse(new TaskNotFoundError(id));

    if (isTerminal(task.status as TaskStatus)) {
      return errorResponse(
        new ValidationError(`Cannot cancel task with status: ${task.status}`),
      );
    }

    const { data: updated, error: updateErr } = await supabase
      .from('tasks')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (updateErr) return errorResponse(new Error(updateErr.message));

    return successResponse(updated);
  } catch (err) {
    return errorResponse(err);
  }
}
