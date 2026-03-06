'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';

export function MarketplaceSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [minTrust, setMinTrust] = useState(searchParams.get('minTrust') ?? '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navigate = useCallback(
    (q: string, trust: string) => {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (trust) params.set('minTrust', trust);
      const qs = params.toString();
      router.push(`/marketplace${qs ? `?${qs}` : ''}`);
    },
    [router],
  );

  // Debounced navigation on text input change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      navigate(query, minTrust);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, minTrust, navigate]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    navigate(query, minTrust);
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
