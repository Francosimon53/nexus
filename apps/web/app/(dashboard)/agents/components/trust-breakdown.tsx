'use client';

import type { TrustComponents } from '@nexus-protocol/shared';
import { TRUST_WEIGHTS } from '@nexus-protocol/shared';

const COMPONENT_CONFIG = {
  reliability: { label: 'Reliability', color: 'bg-blue-500' },
  speed: { label: 'Speed', color: 'bg-cyan-500' },
  quality: { label: 'Quality', color: 'bg-purple-500' },
  tenure: { label: 'Tenure', color: 'bg-amber-500' },
} as const;

export function TrustBreakdown({ components }: { components: TrustComponents }) {
  return (
    <div className="space-y-3">
      {(Object.keys(COMPONENT_CONFIG) as Array<keyof typeof COMPONENT_CONFIG>).map((key) => {
        const config = COMPONENT_CONFIG[key];
        const value = Math.round(components[key]);
        const weight = Math.round(TRUST_WEIGHTS[key] * 100);
        return (
          <div key={key}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-text-secondary">
                {config.label} <span className="text-text-secondary/50">({weight}%)</span>
              </span>
              <span className="tabular-nums font-medium">{value}</span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-overlay">
              <div
                className={`h-full rounded-full transition-all ${config.color}`}
                style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
