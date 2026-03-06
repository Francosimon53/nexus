'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface UseAgentModalProps {
  agentId: string;
  agentName: string;
  costPerTask: number;
  userBalance: number | null; // null = not logged in
}

export function UseAgentModal({ agentId, agentName, costPerTask, userBalance }: UseAgentModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const closeModal = useCallback(() => {
    setOpen(false);
    setConfirming(false);
    setError('');
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeModal();
    }
    document.addEventListener('keydown', onKeyDown);
    dialogRef.current?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, closeModal]);

  function handleOpen() {
    if (userBalance === null) {
      router.push(`/auth/login?next=/marketplace/${agentId}`);
      return;
    }
    setOpen(true);
    setError('');
    setConfirming(false);
  }

  function handleSubmit() {
    if (!message.trim()) return;

    if (!confirming) {
      setConfirming(true);
      return;
    }

    sendTask();
  }

  async function sendTask() {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/dashboard/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, message: message.trim() }),
      });

      const json = await res.json();

      if (json.data?.error === 'INSUFFICIENT_CREDITS') {
        setError(`Insufficient credits. You have ${json.data.balance} credits but this task costs ${json.data.cost}.`);
        setConfirming(false);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError(json.error?.message ?? 'Failed to create task');
        setConfirming(false);
        setLoading(false);
        return;
      }

      if (json.data?.taskId) {
        router.push(`/tasks/${json.data.taskId}`);
      }
    } catch {
      setError('Network error. Please try again.');
      setConfirming(false);
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className="rounded-lg bg-nexus-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-nexus-500 transition-colors"
      >
        Use This Agent
      </button>
    );
  }

  const hasEnough = userBalance !== null && userBalance >= costPerTask;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={closeModal}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 outline-none" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Send Task to {agentName}</h2>
          <button
            onClick={closeModal}
            className="text-text-secondary hover:text-text-primary text-lg"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <textarea
          value={message}
          onChange={(e) => { setMessage(e.target.value); setConfirming(false); }}
          placeholder="Describe your task or paste content..."
          rows={5}
          disabled={loading}
          className="mb-4 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-nexus-500 focus:outline-none resize-none disabled:opacity-50"
        />

        {confirming && (
          <div className="mb-4 rounded-lg border border-nexus-600/30 bg-nexus-600/5 px-4 py-3 text-sm">
            <p className="font-medium">Confirm task submission</p>
            <p className="mt-1 text-text-secondary">
              Cost: <span className="font-medium text-nexus-400">{costPerTask || 'Free'}</span>
              {costPerTask > 0 && (
                <> credits &middot; Your balance: <span className={hasEnough ? 'text-green-400' : 'text-red-400'}>{userBalance} credits</span></>
              )}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-xs text-text-secondary">
            {costPerTask > 0 ? `${costPerTask} credits per task` : 'Free'}
          </span>
          <div className="flex gap-2">
            <button
              onClick={closeModal}
              disabled={loading}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-overlay transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !message.trim()}
              className="rounded-lg bg-nexus-600 px-4 py-2 text-sm font-medium text-white hover:bg-nexus-500 transition-colors disabled:opacity-50"
            >
              {loading ? 'Sending...' : confirming ? 'Confirm & Send' : 'Send Task'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TryAgentButton({
  agentId,
  agentName,
  costPerTask,
  userBalance,
}: UseAgentModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const tryDialogRef = useRef<HTMLDivElement>(null);

  const closeTryModal = useCallback(() => {
    setOpen(false);
    setConfirming(false);
    setError('');
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeTryModal();
    }
    document.addEventListener('keydown', onKeyDown);
    tryDialogRef.current?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, closeTryModal]);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (userBalance === null) {
      router.push(`/auth/login?next=/marketplace/${agentId}`);
      return;
    }
    setOpen(true);
    setError('');
    setConfirming(false);
  }

  async function sendTask() {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/dashboard/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, message: message.trim() }),
      });

      const json = await res.json();

      if (json.data?.error === 'INSUFFICIENT_CREDITS') {
        setError(`Insufficient credits (${json.data.balance}/${json.data.cost}).`);
        setConfirming(false);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError(json.error?.message ?? 'Failed');
        setConfirming(false);
        setLoading(false);
        return;
      }

      if (json.data?.taskId) {
        router.push(`/tasks/${json.data.taskId}`);
      }
    } catch {
      setError('Network error');
      setConfirming(false);
      setLoading(false);
    }
  }

  function handleSubmit() {
    if (!message.trim()) return;
    if (!confirming) { setConfirming(true); return; }
    sendTask();
  }

  return (
    <>
      <button
        onClick={handleClick}
        className="rounded bg-nexus-600/20 px-2 py-0.5 text-[10px] font-medium text-nexus-400 hover:bg-nexus-600/30 transition-colors"
      >
        Try
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={(e) => { e.stopPropagation(); closeTryModal(); }}>
          <div ref={tryDialogRef} tabIndex={-1} role="dialog" aria-modal="true" className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 outline-none" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Try {agentName}</h2>
              <button onClick={closeTryModal} className="text-text-secondary hover:text-text-primary text-lg">&times;</button>
            </div>

            {error && (
              <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
            )}

            <textarea
              value={message}
              onChange={(e) => { setMessage(e.target.value); setConfirming(false); }}
              placeholder="Describe your task..."
              rows={4}
              disabled={loading}
              className="mb-4 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-nexus-500 focus:outline-none resize-none disabled:opacity-50"
            />

            {confirming && (
              <div className="mb-4 rounded-lg border border-nexus-600/30 bg-nexus-600/5 px-4 py-3 text-sm">
                <p className="text-text-secondary">
                  Cost: <span className="font-medium text-nexus-400">{costPerTask || 'Free'}</span>
                  {costPerTask > 0 && userBalance !== null && (
                    <> credits &middot; Balance: <span className={userBalance >= costPerTask ? 'text-green-400' : 'text-red-400'}>{userBalance}</span></>
                  )}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={closeTryModal} disabled={loading} className="rounded-lg border border-border px-4 py-2 text-sm text-text-primary hover:bg-surface-overlay transition-colors disabled:opacity-50">Cancel</button>
              <button onClick={handleSubmit} disabled={loading || !message.trim()} className="rounded-lg bg-nexus-600 px-4 py-2 text-sm font-medium text-white hover:bg-nexus-500 transition-colors disabled:opacity-50">
                {loading ? 'Sending...' : confirming ? 'Confirm' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
