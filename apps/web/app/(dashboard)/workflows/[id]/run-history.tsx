'use client';

import { useState } from 'react';

interface StepResult {
  stepIndex: number;
  status: string;
  taskId: string | null;
  output: Record<string, unknown> | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

interface Run {
  id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  step_results: StepResult[];
  error: string | null;
  created_at: string;
}

const statusColor: Record<string, string> = {
  completed: 'text-green-400',
  failed: 'text-red-400',
  running: 'text-nexus-400',
  pending: 'text-text-secondary',
  skipped: 'text-yellow-400',
};

export function RunHistory({ runs }: { runs: Run[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (runs.length === 0) {
    return (
      <p className="text-sm text-text-secondary">No runs yet. Execute the workflow to see results.</p>
    );
  }

  return (
    <div className="space-y-2">
      {runs.map((run) => (
        <div key={run.id} className="rounded-lg border border-border bg-surface-raised">
          <button
            onClick={() => setExpanded(expanded === run.id ? null : run.id)}
            className="flex w-full items-center justify-between p-3 text-left text-sm"
          >
            <div className="flex items-center gap-3">
              <span className={`font-medium ${statusColor[run.status] ?? 'text-text-secondary'}`}>
                {run.status}
              </span>
              <span className="text-xs text-text-secondary font-mono">
                {run.id.slice(0, 8)}
              </span>
            </div>
            <span className="text-xs text-text-secondary">
              {new Date(run.created_at).toLocaleString()}
            </span>
          </button>

          {expanded === run.id && (
            <div className="border-t border-border px-3 pb-3 pt-2">
              {run.error && (
                <p className="mb-2 text-xs text-red-400">{run.error}</p>
              )}
              {run.step_results && run.step_results.length > 0 ? (
                <div className="space-y-1">
                  {run.step_results.map((sr) => (
                    <div
                      key={sr.stepIndex}
                      className="flex items-center justify-between rounded bg-surface-overlay px-2 py-1.5 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-text-secondary">Step {sr.stepIndex + 1}</span>
                        <span className={statusColor[sr.status] ?? 'text-text-secondary'}>
                          {sr.status}
                        </span>
                      </div>
                      {sr.error && (
                        <span className="text-red-400/70 truncate max-w-[200px]">{sr.error}</span>
                      )}
                      {sr.taskId && (
                        <a
                          href={`/tasks/${sr.taskId}`}
                          className="text-nexus-400 hover:text-nexus-300"
                        >
                          View task
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-secondary">No step results yet</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
