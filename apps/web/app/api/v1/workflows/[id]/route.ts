import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { successResponse, errorResponse } from '@/lib/api-utils';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data: workflow, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !workflow) {
      return errorResponse(new Error('Workflow not found'));
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
