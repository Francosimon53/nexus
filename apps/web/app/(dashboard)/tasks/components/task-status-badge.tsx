'use client';

const statusConfig = {
  pending: { dot: 'bg-gray-500', label: 'Pending' },
  assigned: { dot: 'bg-blue-500', label: 'Assigned' },
  running: { dot: 'bg-yellow-500', label: 'Running' },
  completed: { dot: 'bg-green-500', label: 'Completed' },
  failed: { dot: 'bg-red-500', label: 'Failed' },
  cancelled: { dot: 'bg-gray-500', label: 'Cancelled' },
} as const;

export function TaskStatusBadge({ status }: { status: string }) {
  const config = statusConfig[status as keyof typeof statusConfig] ?? statusConfig.pending;

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
      <span className={`h-2 w-2 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
