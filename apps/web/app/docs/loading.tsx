import LoadingSkeleton from '@/components/loading-skeleton';

export default function Loading() {
  return (
    <div className="min-h-screen bg-surface">
      <div className="mx-auto max-w-4xl px-4 py-12">
        <LoadingSkeleton rows={8} />
      </div>
    </div>
  );
}
