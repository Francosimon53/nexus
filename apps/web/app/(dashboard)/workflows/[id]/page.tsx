export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { ExecuteButton } from './execute-button';
import { RunHistory } from './run-history';

const stepStatusColor: Record<string, string> = {
  completed: 'border-green-500',
  failed: 'border-red-500',
  running: 'border-nexus-500',
  pending: 'border-border',
  skipped: 'border-yellow-500',
};

export default async function WorkflowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: workflow } = await supabase
    .from('workflows')
    .select('*')
    .eq('id', id)
    .single();

  if (!workflow) notFound();

  const { data: runs } = await supabase
    .from('workflow_runs')
    .select('*')
    .eq('workflow_id', id)
    .order('created_at', { ascending: false })
    .limit(10);

  // Fetch agent names for display
  const steps = Array.isArray(workflow.steps) ? (workflow.steps as { name?: string; agentId: string; skillId: string; timeout?: number; dependsOn?: number[] }[]) : [];
  const agentIds = [...new Set(steps.map((s) => s.agentId))];
  let agentNames: Record<string, string> = {};
  if (agentIds.length > 0) {
    const { data: agents } = await supabase
      .from('agents')
      .select('id, name')
      .in('id', agentIds);
    if (agents) {
      agentNames = Object.fromEntries(agents.map((a) => [a.id as string, a.name as string]));
    }
  }

  return (
    <div className="max-w-3xl">
      <Link href="/workflows" className="mb-4 inline-block text-sm text-nexus-400 hover:text-nexus-300">
        &larr; Back to Workflows
      </Link>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{workflow.name as string}</h1>
          {workflow.description && (
            <p className="mt-1 text-text-secondary">{workflow.description as string}</p>
          )}
        </div>
        <ExecuteButton workflowId={id} />
      </div>

      {/* Pipeline View */}
      <div className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-text-secondary">Pipeline</h2>
        <div className="relative pl-4">
          {/* Vertical line */}
          <div className="absolute left-[1.05rem] top-0 bottom-0 w-px bg-border" />

          {steps.map((step, idx) => {
            // Check latest run for step status
            const latestRun = runs?.[0];
            const stepResult = latestRun?.step_results
              ? (latestRun.step_results as { stepIndex: number; status: string }[]).find((sr) => sr.stepIndex === idx)
              : null;
            const borderClass = stepResult ? (stepStatusColor[stepResult.status] ?? 'border-border') : 'border-border';

            return (
              <div key={idx} className="relative mb-3 last:mb-0">
                {/* Dot on the line */}
                <div className="absolute -left-0.5 top-4 h-2.5 w-2.5 rounded-full border-2 border-surface-raised bg-surface-overlay" />

                <div className={`ml-5 rounded-lg border-2 ${borderClass} bg-surface-raised p-3`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-text-secondary">#{idx + 1}</span>
                      <span className="font-medium text-sm">
                        {step.name || `Step ${idx + 1}`}
                      </span>
                    </div>
                    {stepResult && (
                      <span className={`text-xs font-medium ${
                        stepResult.status === 'completed' ? 'text-green-400' :
                        stepResult.status === 'failed' ? 'text-red-400' :
                        stepResult.status === 'running' ? 'text-nexus-400' :
                        'text-text-secondary'
                      }`}>
                        {stepResult.status}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-xs text-text-secondary">
                    <span>Agent: {agentNames[step.agentId] ?? step.agentId.slice(0, 8)}</span>
                    <span>Skill: {step.skillId}</span>
                    {step.timeout && <span>{step.timeout}s timeout</span>}
                  </div>
                  {step.dependsOn && step.dependsOn.length > 0 && (
                    <div className="mt-1 text-[10px] text-text-secondary/60">
                      Depends on: {step.dependsOn.map((d) => `Step ${d + 1}`).join(', ')}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Run History */}
      <div>
        <h2 className="mb-3 text-sm font-medium text-text-secondary">Run History</h2>
        <RunHistory runs={(runs ?? []) as never[]} />
      </div>
    </div>
  );
}
