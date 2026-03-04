import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { executeWorkflow } from '@/lib/workflow-executor';

export async function POST(
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

    // Create workflow run
    const { data: run, error: runErr } = await supabase
      .from('workflow_runs')
      .insert({
        workflow_id: id,
        status: 'pending',
        step_results: [],
      })
      .select('*')
      .single();

    if (runErr || !run) {
      return errorResponse(new Error(runErr?.message ?? 'Failed to create run'));
    }

    // Execute asynchronously (fire and forget)
    executeWorkflow(supabase, workflow as { id: string; name: string; owner_user_id: string; steps: never[] }, run.id as string).catch(
      async (err) => {
        console.error('Workflow execution failed:', err);
        await supabase
          .from('workflow_runs')
          .update({
            status: 'failed',
            error: err instanceof Error ? err.message : String(err),
            completed_at: new Date().toISOString(),
          })
          .eq('id', run.id);
      },
    );

    return successResponse(run, 202);
  } catch (err) {
    return errorResponse(err);
  }
}
