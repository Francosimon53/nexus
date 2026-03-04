import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { checkTimeout } from '@/lib/task-timeout';
import { TaskNotFoundError, ValidationError } from '@nexus-protocol/shared';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
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

    await checkTimeout(supabase, task);

    return successResponse(task);
  } catch (err) {
    return errorResponse(err);
  }
}
