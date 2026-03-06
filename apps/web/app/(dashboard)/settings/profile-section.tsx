'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

interface ProfileSectionProps {
  currentName: string;
}

export function ProfileSection({ currentName }: ProfileSectionProps) {
  const [name, setName] = useState(currentName);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const supabase = createBrowserClient(
        process.env['NEXT_PUBLIC_SUPABASE_URL']!,
        process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
      );

      const { error } = await supabase.auth.updateUser({
        data: { full_name: name.trim() },
      });

      if (error) {
        setMessage({ type: 'error', text: error.message });
      } else {
        setMessage({ type: 'success', text: 'Display name updated.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to update profile.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-surface-raised p-6">
      <h2 className="text-lg font-semibold mb-4">Profile</h2>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label htmlFor="display-name" className="block text-xs font-medium text-text-secondary mb-1">
            Display name
          </label>
          <input
            id="display-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-nexus-500"
            placeholder="Your name"
            maxLength={100}
          />
        </div>

        {message && (
          <p className={`text-sm ${message.type === 'error' ? 'text-red-400' : 'text-green-400'}`}>
            {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || name.trim() === currentName}
          className="rounded-md bg-nexus-600 px-4 py-2 text-sm font-medium text-white hover:bg-nexus-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : 'Save'}
        </button>
      </form>
    </section>
  );
}
