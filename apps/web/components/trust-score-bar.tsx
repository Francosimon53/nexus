'use client';

function getColor(score: number) {
  if (score >= 80) return 'bg-green-500';
  if (score >= 50) return 'bg-nexus-500';
  return 'bg-red-500';
}

export function TrustScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-surface-overlay">
        <div
          className={`h-full rounded-full transition-all ${getColor(score)}`}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-text-secondary">{score}</span>
    </div>
  );
}
