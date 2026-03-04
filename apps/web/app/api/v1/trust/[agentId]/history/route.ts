import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { AgentNotFoundError, ValidationError } from '@nexus-protocol/shared';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const { agentId } = await params;
    if (!UUID_RE.test(agentId)) return errorResponse(new ValidationError('Invalid agent ID'));

    const supabase = getSupabaseAdmin();

    // Validate agent exists
    const { data: agent, error: agentErr } = await supabase
      .from('agents')
      .select('id')
      .eq('id', agentId)
      .single();

    if (agentErr || !agent) return errorResponse(new AgentNotFoundError(agentId));

    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 100);
    const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);

    const { data: events, count, error } = await supabase
      .from('trust_events')
      .select('*', { count: 'exact' })
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return errorResponse(new Error(error.message));

    return successResponse({
      events: events ?? [],
      total: count ?? 0,
      limit,
      offset,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
