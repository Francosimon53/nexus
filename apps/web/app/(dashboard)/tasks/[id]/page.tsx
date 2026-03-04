export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { TaskStatusBadge } from '../components/task-status-badge';
import { MessageTimeline } from '../components/message-timeline';
import { ArtifactList } from '../components/artifact-list';

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: task } = await supabase
    .from('tasks')
    .select('*, agents!tasks_assigned_agent_id_fkey(name, endpoint)')
    .eq('id', id)
    .single();

  if (!task) notFound();

  const agent = task.agents as { name: string; endpoint: string } | null;

  return (
    <div className="max-w-3xl">
      <Link href="/tasks" className="mb-4 inline-block text-sm text-nexus-400 hover:text-nexus-300">
        &larr; Back to Tasks
      </Link>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{task.title}</h1>
          {task.description && (
            <p className="mt-1 text-text-secondary">{task.description}</p>
          )}
        </div>
        <TaskStatusBadge status={task.status} />
      </div>

      {/* Details Grid */}
      <div className="mb-6 grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-surface-raised p-4">
          <h3 className="mb-1 text-xs font-medium text-text-secondary">Assigned Agent</h3>
          <p className="text-sm">{agent?.name ?? 'Unknown'}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface-raised p-4">
          <h3 className="mb-1 text-xs font-medium text-text-secondary">Created</h3>
          <p className="text-sm">{new Date(task.created_at).toLocaleString()}</p>
        </div>
        {task.timeout_at && (
          <div className="rounded-lg border border-border bg-surface-raised p-4">
            <h3 className="mb-1 text-xs font-medium text-text-secondary">Timeout</h3>
            <p className="text-sm">{new Date(task.timeout_at).toLocaleString()}</p>
          </div>
        )}
        {task.error_message && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
            <h3 className="mb-1 text-xs font-medium text-red-400">Error</h3>
            <p className="text-sm text-red-300">{task.error_message}</p>
          </div>
        )}
        {task.max_budget_credits > 0 && (
          <div className="rounded-lg border border-border bg-surface-raised p-4">
            <h3 className="mb-1 text-xs font-medium text-text-secondary">Budget</h3>
            <p className="text-sm">{task.actual_cost_credits} / {task.max_budget_credits} credits</p>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="mb-6">
        <h2 className="mb-3 text-sm font-medium text-text-secondary">Messages</h2>
        <MessageTimeline messages={task.messages ?? []} />
      </div>

      {/* Artifacts */}
      <div className="mb-6">
        <h2 className="mb-3 text-sm font-medium text-text-secondary">Artifacts</h2>
        <ArtifactList artifacts={task.artifacts ?? []} />
      </div>

      {/* Input / Output JSON */}
      {task.input && Object.keys(task.input).length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-text-secondary">Input</h2>
          <pre className="rounded-lg border border-border bg-surface-raised p-4 text-xs overflow-auto">
            {JSON.stringify(task.input, null, 2)}
          </pre>
        </div>
      )}

      {task.output && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-text-secondary">Output</h2>
          <pre className="rounded-lg border border-border bg-surface-raised p-4 text-xs overflow-auto">
            {JSON.stringify(task.output, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
