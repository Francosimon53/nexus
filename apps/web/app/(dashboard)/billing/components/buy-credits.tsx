'use client';

import { useState } from 'react';
import { CREDIT_PACKAGES } from '@nexus-protocol/shared';

export function BuyCredits() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function handleBuy(packageId: string) {
    setLoading(packageId);
    setError('');
    try {
      const res = await fetch('/api/dashboard/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId }),
      });
      const json = await res.json();
      if (json.data?.url) {
        window.location.href = json.data.url;
        return;
      }
      setError(json.error?.message ?? 'Failed to start checkout. Please try again.');
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Buy Credits</h2>
      {error && (
        <p className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        {CREDIT_PACKAGES.map((pkg) => (
          <div
            key={pkg.id}
            className="rounded-lg border border-border bg-surface-raised p-5 flex flex-col"
          >
            <p className="text-2xl font-bold">{pkg.credits.toLocaleString()}</p>
            <p className="text-sm text-text-secondary">credits</p>
            <p className="mt-2 text-lg font-semibold">
              ${(pkg.priceUsd / 100).toFixed(0)}
            </p>
            <p className="text-xs text-text-secondary mb-4">
              ${((pkg.priceUsd / pkg.credits) * 100).toFixed(1)}c per credit
            </p>
            <button
              onClick={() => handleBuy(pkg.id)}
              disabled={loading !== null}
              className="mt-auto rounded-lg bg-nexus-600 px-4 py-2 text-sm font-medium text-white hover:bg-nexus-500 transition-colors disabled:opacity-50"
            >
              {loading === pkg.id ? 'Loading...' : 'Buy'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
