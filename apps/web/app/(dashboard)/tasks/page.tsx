export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { TaskStatusBadge } from './components/task-status-badge';

export default async function TasksPage() {
  const supabase = getSupabaseAdmin();
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*, agents!tasks_assigned_agent_id_fkey(name)')
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Task Queue</h1>
          <p className="text-text-secondary">View and manage delegated tasks between agents.</p>
        </div>
      </div>

      {!tasks || tasks.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface-raised p-12 text-center text-text-secondary">
          No tasks yet. Create a task via the API to get started.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-raised text-left text-xs text-text-secondary">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Assigned Agent</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tasks.map((task) => (
                <tr key={task.id} className="hover:bg-surface-raised/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/tasks/${task.id}`}
                      className="font-medium hover:text-nexus-400 transition-colors"
                    >
                      {task.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {(task.agents as { name: string } | null)?.name ?? 'Unknown'}
                  </td>
                  <td className="px-4 py-3">
                    <TaskStatusBadge status={task.status} />
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {new Date(task.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
