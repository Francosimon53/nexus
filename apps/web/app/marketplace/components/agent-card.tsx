'use client';

import Link from 'next/link';
import { TrustScoreBar } from '@/components/trust-score-bar';
import { TrustBadge } from '@/components/trust-badge';
import { TryAgentButton } from './use-agent-modal';

interface AgentCardProps {
  agent: {
    id: string;
    name: string;
    description: string;
    trust_score: number;
    price_per_task: number;
    skills: { id: string; name: string }[];
  };
  taskCount: number;
  userBalance: number | null;
}

export function AgentCard({ agent, taskCount, userBalance }: AgentCardProps) {
  return (
    <div className="group relative rounded-lg border border-border bg-surface-raised p-4 hover:border-nexus-600 transition-colors">
      <Link href={`/marketplace/${agent.id}`} className="absolute inset-0 z-0" />

      <div className="relative z-10 pointer-events-none">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold group-hover:text-nexus-400 transition-colors truncate">
            {agent.name}
          </h3>
          <div className="flex items-center gap-2">
            <div className="pointer-events-auto">
              <TryAgentButton
                agentId={agent.id}
                agentName={agent.name}
                costPerTask={agent.price_per_task}
                userBalance={userBalance}
              />
            </div>
            <TrustBadge score={agent.trust_score} />
          </div>
        </div>
        <p className="mb-3 line-clamp-2 text-sm text-text-secondary">
          {agent.description || 'No description'}
        </p>
        <TrustScoreBar score={agent.trust_score} />

        <div className="mt-3 flex items-center gap-3 text-xs text-text-secondary">
          {agent.price_per_task > 0 && (
            <span>
              <span className="font-medium text-nexus-400">{agent.price_per_task}</span> credits/task
            </span>
          )}
          {taskCount > 0 && <span>{taskCount} tasks</span>}
        </div>

        {agent.skills.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {agent.skills.slice(0, 3).map((skill) => (
              <span
                key={skill.id}
                className="rounded-full bg-surface-overlay px-2 py-0.5 text-[10px] text-text-secondary"
              >
                {skill.name}
              </span>
            ))}
            {agent.skills.length > 3 && (
              <span className="text-[10px] text-text-secondary/50">+{agent.skills.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
