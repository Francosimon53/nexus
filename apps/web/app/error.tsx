'use client';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface text-center p-8">
      <h2 className="mb-2 text-xl font-bold text-red-400">Something went wrong</h2>
      <p className="mb-6 max-w-md text-sm text-text-secondary">
        {error.message || 'An unexpected error occurred.'}
      </p>
      <button
        onClick={reset}
        className="rounded-lg bg-nexus-600 px-4 py-2 text-sm font-medium text-white hover:bg-nexus-500 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
