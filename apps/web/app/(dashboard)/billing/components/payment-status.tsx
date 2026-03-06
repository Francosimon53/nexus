'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect } from 'react';

function PaymentStatusInner() {
  const searchParams = useSearchParams();
  const success = searchParams.get('success');
  const cancelled = searchParams.get('cancelled');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (success === 'true' || cancelled === 'true') {
      setVisible(true);
    }
  }, [success, cancelled]);

  if (!visible) return null;

  const isSuccess = success === 'true';

  return (
    <div
      className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm ${
        isSuccess
          ? 'border-green-500/30 bg-green-500/10 text-green-400'
          : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400'
      }`}
    >
      <p>
        {isSuccess
          ? 'Payment successful! Credits have been added to your account.'
          : 'Payment was cancelled. No charges were made.'}
      </p>
      <button
        onClick={() => setVisible(false)}
        className="ml-4 shrink-0 rounded p-1 hover:bg-white/10 transition-colors"
        aria-label="Dismiss"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3l8 8M11 3l-8 8" />
        </svg>
      </button>
    </div>
  );
}

export function PaymentStatus() {
  return (
    <Suspense fallback={null}>
      <PaymentStatusInner />
    </Suspense>
  );
}
