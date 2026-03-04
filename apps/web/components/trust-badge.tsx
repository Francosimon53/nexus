'use client';

import type { TrustBadge as TrustBadgeType } from '@nexus-protocol/shared';
import { getTrustBadge } from '@nexus-protocol/shared';

const badgeStyles: Record<TrustBadgeType, string> = {
  'Verified Elite': 'bg-green-500/10 text-green-400 border-green-500/30',
  'Trusted': 'bg-nexus-500/10 text-nexus-400 border-nexus-500/30',
  'Established': 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  'New': 'bg-gray-500/10 text-gray-400 border-gray-500/30',
};

export function TrustBadge({ score }: { score: number }) {
  const badge = getTrustBadge(score);
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${badgeStyles[badge]}`}>
      {badge}
    </span>
  );
}
