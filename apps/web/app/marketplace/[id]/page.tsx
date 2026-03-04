export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { TrustScoreBar } from '@/components/trust-score-bar';
import { TrustBadge } from '@/components/trust-badge';
import { AgentStatusBadge } from '@/components/agent-status-badge';
import { recalculateTrust } from '@nexus-protocol/protocol';
import type { TrustComponents } from '@nexus-protocol/shared';

export default async function MarketplaceAgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: agent } = await supabase.from('agents').select('*').eq('id', id).single();
  if (!agent) notFound();

  const trustProfile = await recalculateTrust(supabase, id);

  // Task stats
  const { count: totalTasks } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('assigned_agent_id', id);

  const { count: completedTasks } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('assigned_agent_id', id)
    .eq('status', 'completed');

  const completionRate =
    totalTasks && totalTasks > 0
      ? Math.round(((completedTasks ?? 0) / totalTasks) * 100)
      : 0;

  const skills = Array.isArray(agent.skills) ? (agent.skills as { id: string; name: string; description: string; tags?: string[] }[]) : [];
  const components = trustProfile.components as TrustComponents;

  return (
    <div className="max-w-3xl">
      <Link href="/marketplace" className="mb-4 inline-block text-sm text-nexus-400 hover:text-nexus-300">
        &larr; Back to Marketplace
      </Link>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{agent.name as string}</h1>
            <TrustBadge score={trustProfile.trustScore} />
          </div>
          <p className="mt-1 text-text-secondary">{(agent.description as string) || 'No description'}</p>
        </div>
        <AgentStatusBadge status={agent.status as string} />
      </div>

      {/* Stats Grid */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-surface-raised p-4 text-center">
          <div className="text-2xl font-bold tabular-nums">{trustProfile.trustScore}</div>
          <div className="text-xs text-text-secondary">Trust Score</div>
        </div>
        <div className="rounded-lg border border-border bg-surface-raised p-4 text-center">
          <div className="text-2xl font-bold tabular-nums">{totalTasks ?? 0}</div>
          <div className="text-xs text-text-secondary">Total Tasks</div>
        </div>
        <div className="rounded-lg border border-border bg-surface-raised p-4 text-center">
          <div className="text-2xl font-bold tabular-nums">{completionRate}%</div>
          <div className="text-xs text-text-secondary">Completion Rate</div>
        </div>
        <div className="rounded-lg border border-border bg-surface-raised p-4 text-center">
          <div className="text-2xl font-bold tabular-nums text-nexus-400">
            {Number(agent.price_per_task) || 'Free'}
          </div>
          <div className="text-xs text-text-secondary">Credits/Task</div>
        </div>
      </div>

      {/* Trust Score Bar */}
      <div className="mb-6 rounded-lg border border-border bg-surface-raised p-4">
        <h2 className="mb-2 text-sm font-medium text-text-secondary">Trust Score</h2>
        <TrustScoreBar score={trustProfile.trustScore} />
        <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
          {(Object.entries(components) as [string, number][]).map(([key, value]) => (
            <div key={key}>
              <div className="text-text-secondary capitalize">{key}</div>
              <div className="font-medium tabular-nums">{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Skills */}
      {skills.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-text-secondary">Skills</h2>
          <div className="space-y-2">
            {skills.map((skill) => (
              <div key={skill.id} className="rounded-lg border border-border bg-surface-raised p-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{skill.name}</span>
                  <span className="text-xs text-text-secondary font-mono">({skill.id})</span>
                </div>
                <p className="mt-0.5 text-xs text-text-secondary">{skill.description}</p>
                {skill.tags && skill.tags.length > 0 && (
                  <div className="mt-1.5 flex gap-1">
                    {skill.tags.map((t) => (
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

      {/* Tags */}
      {agent.tags && (agent.tags as string[]).length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-text-secondary">Tags</h2>
          <div className="flex flex-wrap gap-1">
            {(agent.tags as string[]).map((tag) => (
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

      {/* CTA */}
      <div className="rounded-lg border border-nexus-600/30 bg-nexus-600/5 p-6 text-center">
        <h2 className="mb-2 font-semibold">Use this Agent</h2>
        <p className="mb-4 text-sm text-text-secondary">
          Add this agent to your workflows or delegate tasks directly.
        </p>
        <div className="flex justify-center gap-3">
          <Link
            href="/workflows/new"
            className="rounded-lg bg-nexus-600 px-4 py-2 text-sm font-medium text-white hover:bg-nexus-500 transition-colors"
          >
            Add to Workflow
          </Link>
          <Link
            href={`/agents/${id}`}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-overlay transition-colors"
          >
            View in Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
