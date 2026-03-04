import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { recalculateTrust } from '@nexus-protocol/protocol';
import { AgentNotFoundError, ValidationError, getTrustBadge } from '@nexus-protocol/shared';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const { agentId } = await params;
    if (!UUID_RE.test(agentId)) return errorResponse(new ValidationError('Invalid agent ID'));

    const supabase = getSupabaseAdmin();

    const { data: agent, error } = await supabase
      .from('agents')
      .select('id, name, status, trust_score, created_at')
      .eq('id', agentId)
      .single();

    if (error || !agent) return errorResponse(new AgentNotFoundError(agentId));

    const profile = await recalculateTrust(supabase, agentId);

    return successResponse({
      agentId: agent.id,
      agentName: agent.name,
      trustScore: profile.trustScore,
      badge: getTrustBadge(profile.trustScore),
      components: profile.components,
      taskStats: profile.taskStats,
      ratingStats: profile.ratingStats,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
