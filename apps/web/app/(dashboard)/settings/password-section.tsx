'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export function PasswordSection() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }
    if (password !== confirm) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setLoading(true);

    try {
      const supabase = createBrowserClient(
        process.env['NEXT_PUBLIC_SUPABASE_URL']!,
        process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
      );

      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setMessage({ type: 'error', text: error.message });
      } else {
        setMessage({ type: 'success', text: 'Password updated.' });
        setPassword('');
        setConfirm('');
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to update password.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-surface-raised p-6">
      <h2 className="text-lg font-semibold mb-4">Change password</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="new-password" className="block text-xs font-medium text-text-secondary mb-1">
            New password
          </label>
          <input
            id="new-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-nexus-500"
            placeholder="At least 6 characters"
            minLength={6}
          />
        </div>
        <div>
          <label htmlFor="confirm-password" className="block text-xs font-medium text-text-secondary mb-1">
            Confirm new password
          </label>
          <input
            id="confirm-password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-nexus-500"
            placeholder="Repeat password"
            minLength={6}
          />
        </div>

        {message && (
          <p className={`text-sm ${message.type === 'error' ? 'text-red-400' : 'text-green-400'}`}>
            {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !password || !confirm}
          className="rounded-md bg-nexus-600 px-4 py-2 text-sm font-medium text-white hover:bg-nexus-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Updating...' : 'Update password'}
        </button>
      </form>
    </section>
  );
}
