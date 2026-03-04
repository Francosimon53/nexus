export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { AgentStatusBadge } from './components/agent-status-badge';
import { TrustScoreBar } from './components/trust-score-bar';

export default async function AgentsPage() {
  // TODO(phase-2): Replace admin client with authenticated SSR client
  const supabase = getSupabaseAdmin();
  const { data: agents } = await supabase
    .from('agents')
    .select('*')
    .order('trust_score', { ascending: false });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agent Registry</h1>
          <p className="text-text-secondary">Browse, register, and manage your AI agents.</p>
        </div>
        <Link
          href="/agents/register"
          className="rounded-lg bg-nexus-600 px-4 py-2 text-sm font-medium text-white hover:bg-nexus-500 transition-colors"
        >
          Register Agent
        </Link>
      </div>

      {!agents || agents.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface-raised p-12 text-center text-text-secondary">
          No agents registered yet. Register your first agent to get started.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <Link
              key={agent.id}
              href={`/agents/${agent.id}`}
              className="group rounded-lg border border-border bg-surface-raised p-4 hover:border-nexus-600 transition-colors"
            >
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold group-hover:text-nexus-400 transition-colors">
                  {agent.name}
                </h3>
                <AgentStatusBadge status={agent.status} />
              </div>
              <p className="mb-3 line-clamp-2 text-sm text-text-secondary">
                {agent.description || 'No description'}
              </p>
              <TrustScoreBar score={Number(agent.trust_score)} />
              {agent.tags && agent.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {agent.tags.map((tag: string) => (
                    <span
                      key={tag}
                      className="rounded-full bg-surface-overlay px-2 py-0.5 text-xs text-text-secondary"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
