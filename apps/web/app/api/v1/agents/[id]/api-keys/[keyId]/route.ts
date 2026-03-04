import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { AgentNotFoundError, ValidationError } from '@nexus-protocol/shared';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; keyId: string }> },
) {
  try {
    const { id: agentId, keyId } = await params;
    if (!UUID_RE.test(agentId)) return errorResponse(new ValidationError('Invalid agent ID'));
    if (!UUID_RE.test(keyId)) return errorResponse(new ValidationError('Invalid key ID'));

    const supabase = getSupabaseAdmin();

    // Validate agent exists and get owner
    const { data: agent, error: agentErr } = await supabase
      .from('agents')
      .select('id, owner_user_id')
      .eq('id', agentId)
      .single();

    if (agentErr || !agent) return errorResponse(new AgentNotFoundError(agentId));

    // Delete key only if it belongs to this agent's owner
    const { error: deleteErr } = await supabase
      .from('api_keys')
      .delete()
      .eq('id', keyId)
      .eq('user_id', agent.owner_user_id);

    if (deleteErr) return errorResponse(new Error(deleteErr.message));

    return successResponse({ deleted: true });
  } catch (err) {
    return errorResponse(err);
  }
}
