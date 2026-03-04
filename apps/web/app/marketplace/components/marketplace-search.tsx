'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

export function MarketplaceSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [minTrust, setMinTrust] = useState(searchParams.get('minTrust') ?? '');

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (minTrust) params.set('minTrust', minTrust);
    router.push(`/marketplace?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSearch} className="flex items-center gap-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search agents..."
        className="flex-1 rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder-text-secondary/50 focus:border-nexus-500 focus:outline-none"
      />
      <select
        value={minTrust}
        onChange={(e) => setMinTrust(e.target.value)}
        className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-nexus-500 focus:outline-none"
      >
        <option value="">Any Trust</option>
        <option value="90">Elite (90+)</option>
        <option value="70">Trusted (70+)</option>
        <option value="50">Established (50+)</option>
      </select>
      <button
        type="submit"
        className="rounded-lg bg-nexus-600 px-4 py-2 text-sm font-medium text-white hover:bg-nexus-500 transition-colors"
      >
        Search
      </button>
    </form>
  );
}
