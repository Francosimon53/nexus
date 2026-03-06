export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { createSupabaseSSR } from '@/lib/supabase';
import { TaskStatusBadge } from './components/task-status-badge';

const PAGE_SIZE = 25;

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? '1', 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createSupabaseSSR();
  const { data: tasks, count } = await supabase
    .from('tasks')
    .select('*, agents!tasks_assigned_agent_id_fkey(name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  const total = count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

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
          {page > 1 ? 'No more tasks.' : 'No tasks yet. Create a task via the API to get started.'}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
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
                    <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                      {new Date(task.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <p className="text-text-secondary">
                {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total} tasks
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={`/tasks?page=${page - 1}`}
                    className="rounded-md border border-border px-3 py-1.5 text-text-secondary hover:bg-surface-raised hover:text-text-primary transition-colors"
                  >
                    Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={`/tasks?page=${page + 1}`}
                    className="rounded-md border border-border px-3 py-1.5 text-text-secondary hover:bg-surface-raised hover:text-text-primary transition-colors"
                  >
                    Next
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
