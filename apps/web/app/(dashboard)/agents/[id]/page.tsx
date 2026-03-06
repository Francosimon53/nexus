export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { recalculateTrust } from '@nexus-protocol/protocol';
import { AgentStatusBadge } from '@/components/agent-status-badge';
import { TrustScoreBar } from '@/components/trust-score-bar';
import { TrustBadge } from '@/components/trust-badge';
import { TrustBreakdown } from '../components/trust-breakdown';
import { ApiKeysSection } from '../components/api-keys-section';
import type { TrustComponents } from '@nexus-protocol/shared';

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { data: agent } = await supabase.from('agents').select('*').eq('id', id).single();

  if (!agent) notFound();

  // Recalculate trust for fresh data
  const trustProfile = await recalculateTrust(supabase, id);

  // Fetch API keys
  const { data: apiKeys } = await supabase
    .from('api_keys')
    .select('id, name, prefix, scopes, last_used_at, created_at, expires_at')
    .eq('user_id', agent.owner_user_id)
    .order('created_at', { ascending: false });

  // Fetch recent trust events
  const { data: trustEvents } = await supabase
    .from('trust_events')
    .select('*')
    .eq('agent_id', id)
    .order('created_at', { ascending: false })
    .limit(10);

  return (
    <div className="max-w-3xl">
      <Link href="/agents" className="mb-4 inline-block text-sm text-nexus-400 hover:text-nexus-300">
        &larr; Back to Agents
      </Link>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{agent.name}</h1>
            <TrustBadge score={trustProfile.trustScore} />
          </div>
          <p className="mt-1 text-text-secondary">{agent.description || 'No description'}</p>
        </div>
        <AgentStatusBadge status={agent.status} />
      </div>

      {/* Trust Score + Breakdown */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface-raised p-4">
          <h2 className="mb-2 text-sm font-medium text-text-secondary">Trust Score</h2>
          <div className="mb-1 text-3xl font-bold tabular-nums">{trustProfile.trustScore}</div>
          <TrustScoreBar score={trustProfile.trustScore} />
          <div className="mt-2 flex gap-4 text-[10px] text-text-secondary">
            <span>{trustProfile.taskStats.total} tasks</span>
            <span>{trustProfile.taskStats.completed} completed</span>
            <span>{trustProfile.ratingStats.count} ratings</span>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface-raised p-4">
          <h2 className="mb-2 text-sm font-medium text-text-secondary">Component Breakdown</h2>
          <TrustBreakdown components={trustProfile.components as TrustComponents} />
        </div>
      </div>

      {/* Details */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface-raised p-4">
          <h3 className="mb-1 text-xs font-medium text-text-secondary">Endpoint</h3>
          <p className="break-all text-sm font-mono">{agent.endpoint}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface-raised p-4">
          <h3 className="mb-1 text-xs font-medium text-text-secondary">Last Heartbeat</h3>
          <p className="text-sm">
            {agent.last_heartbeat
              ? new Date(agent.last_heartbeat).toLocaleString()
              : 'Never'}
          </p>
        </div>
      </div>

      {/* Tags */}
      {agent.tags && agent.tags.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-text-secondary">Tags</h2>
          <div className="flex flex-wrap gap-1">
            {agent.tags.map((tag: string) => (
              <span
                key={tag}
                className="rounded-full bg-surface-overlay px-2.5 py-1 text-xs text-text-secondary"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Skills */}
      {agent.skills && agent.skills.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-text-secondary">Skills</h2>
          <div className="space-y-2">
            {agent.skills.map((skill: { id: string; name: string; description: string; tags?: string[] }) => (
              <div key={skill.id} className="rounded-lg border border-border bg-surface-raised p-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{skill.name}</span>
                  <span className="text-xs text-text-secondary font-mono">({skill.id})</span>
                </div>
                <p className="mt-0.5 text-xs text-text-secondary">{skill.description}</p>
                {skill.tags && skill.tags.length > 0 && (
                  <div className="mt-1.5 flex gap-1">
                    {skill.tags.map((t: string) => (
                      <span key={t} className="rounded bg-surface-overlay px-1.5 py-0.5 text-[10px] text-text-secondary">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trust Events */}
      {trustEvents && trustEvents.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-text-secondary">Recent Trust Events</h2>
          <div className="space-y-1">
            {trustEvents.map((event: Record<string, unknown>) => {
              const score = Number(event.score);
              return (
                <div
                  key={event.id as string}
                  className="flex items-center justify-between rounded-md border border-border bg-surface-raised px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className={`font-mono font-medium ${score >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {score >= 0 ? '+' : ''}{score}
                    </span>
                    <span className="text-text-secondary">{event.event_type as string}</span>
                    {typeof event.reason === 'string' && event.reason && (
                      <span className="text-text-secondary/60">— {event.reason}</span>
                    )}
                  </div>
                  <span className="text-text-secondary/50">
                    {new Date(event.created_at as string).toLocaleDateString()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* API Keys */}
      <div className="mb-6">
        <ApiKeysSection agentId={id} initialKeys={apiKeys ?? []} />
      </div>

      {/* Metadata */}
      {agent.metadata && Object.keys(agent.metadata).length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-text-secondary">Metadata</h2>
          <pre className="rounded-lg border border-border bg-surface-raised p-4 text-xs overflow-auto">
            {JSON.stringify(agent.metadata, null, 2)}
          </pre>
        </div>
      )}

      {/* A2A Agent Card */}
      {agent.agent_card && Object.keys(agent.agent_card).length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium text-text-secondary">A2A Agent Card</h2>
          <pre className="rounded-lg border border-border bg-surface-raised p-4 text-xs overflow-auto">
            {JSON.stringify(agent.agent_card, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
