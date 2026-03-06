'use client';

import { useState } from 'react';

interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
}

export function ApiKeysSection({ agentId, initialKeys }: { agentId: string; initialKeys: ApiKeyRow[] }) {
  const [keys, setKeys] = useState<ApiKeyRow[]>(initialKeys);
  const [newKeyName, setNewKeyName] = useState('');
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function createKey() {
    if (!newKeyName.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/agents/${agentId}/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? 'Failed to create API key.');
        return;
      }
      if (json.data) {
        setRevealedKey(json.data.key);
        setKeys((prev) => [{ ...json.data, key: undefined }, ...prev]);
        setNewKeyName('');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function revokeKey(keyId: string, keyName: string) {
    if (!confirm(`Revoke API key "${keyName}"? This cannot be undone.`)) return;
    setError('');
    try {
      const res = await fetch(`/api/v1/agents/${agentId}/api-keys/${keyId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setKeys((prev) => prev.filter((k) => k.id !== keyId));
      } else {
        const json = await res.json();
        setError(json.error?.message ?? 'Failed to revoke key.');
      }
    } catch {
      setError('Network error. Please try again.');
    }
  }

  return (
    <div>
      <h2 className="mb-3 text-sm font-medium text-text-secondary">API Keys</h2>

      {/* Create new key */}
      <div className="mb-4 flex gap-2">
        <input
          type="text"
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          placeholder="Key name"
          className="flex-1 rounded-md border border-border bg-surface-raised px-3 py-1.5 text-sm placeholder:text-text-secondary/50 focus:border-nexus-500 focus:outline-none"
          onKeyDown={(e) => e.key === 'Enter' && createKey()}
        />
        <button
          onClick={createKey}
          disabled={loading || !newKeyName.trim()}
          className="rounded-md bg-nexus-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-nexus-500 disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Generate'}
        </button>
      </div>

      {/* Error message */}
      {error && (
        <p className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}

      {/* Revealed key (shown once) */}
      {revealedKey && (
        <div className="mb-4 rounded-lg border border-green-500/30 bg-green-500/5 p-3">
          <p className="mb-1 text-xs font-medium text-green-400">
            Copy this key now — it won&apos;t be shown again
          </p>
          <code className="block break-all text-xs font-mono text-green-300">{revealedKey}</code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(revealedKey);
              setRevealedKey(null);
            }}
            className="mt-2 text-xs text-green-400 hover:text-green-300"
          >
            Copy & dismiss
          </button>
        </div>
      )}

      {/* Key list */}
      {keys.length === 0 ? (
        <p className="text-xs text-text-secondary">No API keys created yet.</p>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <div
              key={k.id}
              className="flex items-center justify-between rounded-lg border border-border bg-surface-raised px-3 py-2"
            >
              <div>
                <span className="text-sm font-medium">{k.name}</span>
                <span className="ml-2 text-xs text-text-secondary font-mono">{k.prefix}...</span>
                <div className="mt-0.5 text-[10px] text-text-secondary">
                  Created {new Date(k.created_at).toLocaleDateString()}
                  {k.last_used_at && ` · Last used ${new Date(k.last_used_at).toLocaleDateString()}`}
                  {k.expires_at && ` · Expires ${new Date(k.expires_at).toLocaleDateString()}`}
                </div>
              </div>
              <button
                onClick={() => revokeKey(k.id, k.name)}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
