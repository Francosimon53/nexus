export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireUser } from '@/lib/auth';

const runStatusColor: Record<string, string> = {
  completed: 'text-green-400',
  failed: 'text-red-400',
  running: 'text-nexus-400',
  pending: 'text-text-secondary',
};

export default async function WorkflowsPage() {
  const user = await requireUser();
  const supabase = getSupabaseAdmin();

  const { data: workflows } = await supabase
    .from('workflows')
    .select('*')
    .eq('owner_user_id', user.id)
    .order('created_at', { ascending: false });

  // Fetch latest run for each workflow
  const workflowIds = (workflows ?? []).map((w) => w.id as string);
  let latestRuns: Record<string, { status: string; created_at: string }> = {};

  if (workflowIds.length > 0) {
    const { data: runs } = await supabase
      .from('workflow_runs')
      .select('workflow_id, status, created_at')
      .in('workflow_id', workflowIds)
      .order('created_at', { ascending: false });

    if (runs) {
      for (const run of runs) {
        const wfId = run.workflow_id as string;
        if (!latestRuns[wfId]) {
          latestRuns[wfId] = { status: run.status as string, created_at: run.created_at as string };
        }
      }
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workflows</h1>
          <p className="text-text-secondary">Compose multi-agent workflows with visual pipelines.</p>
        </div>
        <Link
          href="/workflows/new"
          className="rounded-lg bg-nexus-600 px-4 py-2 text-sm font-medium text-white hover:bg-nexus-500 transition-colors"
        >
          New Workflow
        </Link>
      </div>

      {!workflows || workflows.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface-raised p-12 text-center text-text-secondary">
          No workflows yet. Create your first workflow to orchestrate agents.
        </div>
      ) : (
        <div className="space-y-3">
          {workflows.map((wf) => {
            const steps = Array.isArray(wf.steps) ? wf.steps : [];
            const lastRun = latestRuns[wf.id as string];
            return (
              <Link
                key={wf.id as string}
                href={`/workflows/${wf.id}`}
                className="group flex items-center justify-between rounded-lg border border-border bg-surface-raised p-4 hover:border-nexus-600 transition-colors"
              >
                <div>
                  <h3 className="font-semibold group-hover:text-nexus-400 transition-colors">
                    {wf.name as string}
                  </h3>
                  {wf.description && (
                    <p className="mt-0.5 text-sm text-text-secondary line-clamp-1">
                      {wf.description as string}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-text-secondary">
                    {steps.length} step{steps.length !== 1 ? 's' : ''}
                  </span>
                  {lastRun && (
                    <span className={runStatusColor[lastRun.status] ?? 'text-text-secondary'}>
                      {lastRun.status}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
