export default function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-48 rounded bg-surface-raised" />
      <div className="h-4 w-64 rounded bg-surface-raised" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="h-12 rounded-lg bg-surface-raised" />
        ))}
      </div>
    </div>
  );
}
