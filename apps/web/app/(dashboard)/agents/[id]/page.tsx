export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { AgentStatusBadge } from '../components/agent-status-badge';
import { TrustScoreBar } from '../components/trust-score-bar';

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { data: agent } = await supabase.from('agents').select('*').eq('id', id).single();

  if (!agent) notFound();

  return (
    <div className="max-w-3xl">
      <Link href="/agents" className="mb-4 inline-block text-sm text-nexus-400 hover:text-nexus-300">
        &larr; Back to Agents
      </Link>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{agent.name}</h1>
          <p className="mt-1 text-text-secondary">{agent.description || 'No description'}</p>
        </div>
        <AgentStatusBadge status={agent.status} />
      </div>

      {/* Trust Score */}
      <div className="mb-6">
        <h2 className="mb-2 text-sm font-medium text-text-secondary">Trust Score</h2>
        <TrustScoreBar score={Number(agent.trust_score)} />
      </div>

      {/* Details */}
      <div className="mb-6 grid grid-cols-2 gap-4">
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
