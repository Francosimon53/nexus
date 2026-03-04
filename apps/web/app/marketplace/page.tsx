export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { TrustScoreBar } from '@/components/trust-score-bar';
import { TrustBadge } from '@/components/trust-badge';
import { AgentStatusBadge } from '@/components/agent-status-badge';
import { MarketplaceSearch } from './components/marketplace-search';

interface PageProps {
  searchParams: Promise<{ q?: string; minTrust?: string; maxPrice?: string }>;
}

export default async function MarketplacePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = getSupabaseAdmin();

  // Featured agents
  const { data: featured } = await supabase
    .from('agents')
    .select('*')
    .eq('featured', true)
    .order('trust_score', { ascending: false })
    .limit(4);

  // All agents query with filters
  let query = supabase.from('agents').select('*', { count: 'exact' });

  if (params.q) {
    query = query.or(`name.ilike.%${params.q}%,description.ilike.%${params.q}%`);
  }
  if (params.minTrust) {
    query = query.gte('trust_score', Number(params.minTrust));
  }
  if (params.maxPrice) {
    query = query.lte('price_per_task', Number(params.maxPrice));
  }

  query = query.order('trust_score', { ascending: false }).limit(20);

  const { data: agents, count } = await query;

  // Get task counts per agent
  let taskCounts: Record<string, number> = {};
  if (agents && agents.length > 0) {
    const agentIds = agents.map((a) => a.id as string);
    const { data: tasks } = await supabase
      .from('tasks')
      .select('assigned_agent_id')
      .in('assigned_agent_id', agentIds);
    if (tasks) {
      for (const t of tasks) {
        const aid = t.assigned_agent_id as string;
        taskCounts[aid] = (taskCounts[aid] ?? 0) + 1;
      }
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Agent Marketplace</h1>
        <p className="text-text-secondary">Discover, evaluate, and deploy AI agents for your workflows.</p>
      </div>

      {/* Search */}
      <div className="mb-8">
        <Suspense fallback={<div className="h-10" />}>
          <MarketplaceSearch />
        </Suspense>
      </div>

      {/* Featured */}
      {featured && featured.length > 0 && !params.q && (
        <div className="mb-10">
          <h2 className="mb-4 text-lg font-semibold">Featured Agents</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((agent) => (
              <Link
                key={agent.id as string}
                href={`/marketplace/${agent.id}`}
                className="group rounded-lg border-2 border-nexus-600/30 bg-surface-raised p-4 hover:border-nexus-500 transition-colors"
              >
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-semibold group-hover:text-nexus-400 transition-colors truncate">
                    {agent.name as string}
                  </h3>
                  <AgentStatusBadge status={agent.status as string} />
                </div>
                <p className="mb-3 line-clamp-2 text-sm text-text-secondary">
                  {(agent.description as string) || 'No description'}
                </p>
                <TrustScoreBar score={Number(agent.trust_score)} />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Agent Grid */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {params.q ? `Results for "${params.q}"` : 'All Agents'}
        </h2>
        <span className="text-sm text-text-secondary">{count ?? 0} agents</span>
      </div>

      {!agents || agents.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface-raised p-12 text-center text-text-secondary">
          No agents found matching your criteria.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => {
            const tasks = taskCounts[agent.id as string] ?? 0;
            const skills = Array.isArray(agent.skills) ? (agent.skills as { id: string; name: string }[]) : [];
            return (
              <Link
                key={agent.id as string}
                href={`/marketplace/${agent.id}`}
                className="group rounded-lg border border-border bg-surface-raised p-4 hover:border-nexus-600 transition-colors"
              >
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-semibold group-hover:text-nexus-400 transition-colors truncate">
                    {agent.name as string}
                  </h3>
                  <TrustBadge score={Number(agent.trust_score)} />
                </div>
                <p className="mb-3 line-clamp-2 text-sm text-text-secondary">
                  {(agent.description as string) || 'No description'}
                </p>
                <TrustScoreBar score={Number(agent.trust_score)} />

                <div className="mt-3 flex items-center gap-3 text-xs text-text-secondary">
                  {Number(agent.price_per_task) > 0 && (
                    <span>
                      <span className="font-medium text-nexus-400">{Number(agent.price_per_task)}</span> credits/task
                    </span>
                  )}
                  {tasks > 0 && <span>{tasks} tasks</span>}
                </div>

                {skills.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {skills.slice(0, 3).map((skill) => (
                      <span
                        key={skill.id}
                        className="rounded-full bg-surface-overlay px-2 py-0.5 text-[10px] text-text-secondary"
                      >
                        {skill.name}
                      </span>
                    ))}
                    {skills.length > 3 && (
                      <span className="text-[10px] text-text-secondary/50">+{skills.length - 3}</span>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
