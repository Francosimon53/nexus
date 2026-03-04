'use client';

const statusConfig = {
  online: { dot: 'bg-green-500', label: 'Online' },
  offline: { dot: 'bg-gray-500', label: 'Offline' },
  degraded: { dot: 'bg-yellow-500', label: 'Degraded' },
} as const;

export function AgentStatusBadge({ status }: { status: string }) {
  const config = statusConfig[status as keyof typeof statusConfig] ?? statusConfig.offline;

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
      <span className={`h-2 w-2 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
