'use client';

import { useState } from 'react';

interface DailyUsage {
  date: string;
  spent: number;
  earned: number;
}

interface UsageData {
  [period: string]: { daily: DailyUsage[]; totalSpent: number; totalEarned: number };
}

export function UsageChart({ usageData }: { usageData: UsageData }) {
  const [period, setPeriod] = useState<string>('30d');
  const data = usageData[period] ?? { daily: [], totalSpent: 0, totalEarned: 0 };
  const { daily, totalSpent, totalEarned } = data;

  const maxVal = Math.max(...daily.map((d) => Math.max(d.spent, d.earned)), 1);

  const chartH = 200;
  const chartW = 600;
  const barW = daily.length > 0 ? Math.max(4, Math.min(20, (chartW - 40) / daily.length / 2)) : 10;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Usage</h2>
        <div className="flex gap-1 rounded-lg bg-surface-overlay p-1">
          {['7d', '30d', '90d'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                period === p
                  ? 'bg-nexus-600 text-white'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface-raised p-4">
        <div className="mb-3 flex gap-6 text-sm">
          <span className="text-text-secondary">
            Spent: <span className="text-red-400 font-medium">{totalSpent.toLocaleString()}</span>
          </span>
          <span className="text-text-secondary">
            Earned:{' '}
            <span className="text-green-400 font-medium">{totalEarned.toLocaleString()}</span>
          </span>
        </div>

        {daily.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-text-secondary text-sm">
            No activity in this period
          </div>
        ) : (
          <svg viewBox={`0 0 ${chartW} ${chartH + 20}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet" aria-label="Usage chart">
            {daily.map((d, i) => {
              const x = 20 + (i * (chartW - 40)) / daily.length;
              const spentH = (d.spent / maxVal) * chartH;
              const earnedH = (d.earned / maxVal) * chartH;
              return (
                <g key={d.date}>
                  <rect
                    x={x}
                    y={chartH - spentH}
                    width={barW}
                    height={spentH}
                    fill="rgba(248,113,113,0.6)"
                    rx={2}
                  />
                  <rect
                    x={x + barW + 1}
                    y={chartH - earnedH}
                    width={barW}
                    height={earnedH}
                    fill="rgba(74,222,128,0.6)"
                    rx={2}
                  />
                </g>
              );
            })}
            <line x1="20" y1={chartH} x2={chartW - 20} y2={chartH} stroke="rgba(255,255,255,0.1)" />
          </svg>
        )}

        <div className="mt-2 flex gap-4 text-xs text-text-secondary">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded bg-red-400" /> Spent
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded bg-green-400" /> Earned
          </span>
        </div>
      </div>
    </div>
  );
}
