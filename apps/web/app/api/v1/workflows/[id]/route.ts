import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { requireApiUser } from '@/lib/api-auth';
import { ValidationError, ForbiddenError } from '@nexus-protocol/shared';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireApiUser();
    const { id } = await params;
    if (!UUID_RE.test(id)) return errorResponse(new ValidationError('Invalid workflow ID'));

    const supabase = getSupabaseAdmin();

    const { data: workflow, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !workflow) {
      return errorResponse(new Error('Workflow not found'));
    }

    if ((workflow as { owner_user_id: string }).owner_user_id !== userId) {
      return errorResponse(new ForbiddenError('You do not own this workflow'));
    }

    // Fetch recent runs
    const { data: runs } = await supabase
      .from('workflow_runs')
      .select('*')
      .eq('workflow_id', id)
      .order('created_at', { ascending: false })
      .limit(10);

    return successResponse({ ...workflow, runs: runs ?? [] });
  } catch (err) {
    return errorResponse(err);
  }
}
