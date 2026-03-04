'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ExecuteButton({ workflowId }: { workflowId: string }) {
  const router = useRouter();
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState('');

  async function handleExecute() {
    setExecuting(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/workflows/${workflowId}/execute`, {
        method: 'POST',
      });
      if (!res.ok) {
        const json = await res.json();
        setError(json.error?.message ?? 'Failed to execute');
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute');
    } finally {
      setExecuting(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleExecute}
        disabled={executing}
        className="rounded-lg bg-nexus-600 px-4 py-2 text-sm font-medium text-white hover:bg-nexus-500 transition-colors disabled:opacity-50"
      >
        {executing ? 'Executing...' : 'Execute Workflow'}
      </button>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
