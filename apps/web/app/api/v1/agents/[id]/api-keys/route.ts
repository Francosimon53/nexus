import { NextRequest } from 'next/server';
import { CreateApiKeySchema } from '@nexus-protocol/shared';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { generateApiKey } from '@/lib/api-key-utils';
import { AgentNotFoundError, ValidationError } from '@nexus-protocol/shared';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: agentId } = await params;
    if (!UUID_RE.test(agentId)) return errorResponse(new ValidationError('Invalid agent ID'));

    const body = await request.json();
    const input = CreateApiKeySchema.parse(body);

    const supabase = getSupabaseAdmin();

    // Validate agent exists and get owner
    const { data: agent, error: agentErr } = await supabase
      .from('agents')
      .select('id, owner_user_id')
      .eq('id', agentId)
      .single();

    if (agentErr || !agent) return errorResponse(new AgentNotFoundError(agentId));

    const { rawKey, prefix, hash } = generateApiKey();

    const expiresAt = input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { data: apiKey, error: insertErr } = await supabase
      .from('api_keys')
      .insert({
        user_id: agent.owner_user_id,
        name: input.name,
        key_hash: hash,
        prefix,
        scopes: input.scopes,
        expires_at: expiresAt,
      })
      .select('id, name, prefix, scopes, created_at, expires_at')
      .single();

    if (insertErr || !apiKey) {
      return errorResponse(new Error(insertErr?.message ?? 'Failed to create API key'));
    }

    // Return raw key only once — it cannot be retrieved later
    return successResponse({
      ...apiKey,
      key: rawKey,
    }, 201);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: agentId } = await params;
    if (!UUID_RE.test(agentId)) return errorResponse(new ValidationError('Invalid agent ID'));

    const supabase = getSupabaseAdmin();

    // Get agent owner
    const { data: agent, error: agentErr } = await supabase
      .from('agents')
      .select('id, owner_user_id')
      .eq('id', agentId)
      .single();

    if (agentErr || !agent) return errorResponse(new AgentNotFoundError(agentId));

    // List keys for this agent's owner (never return hash)
    const { data: keys, error } = await supabase
      .from('api_keys')
      .select('id, name, prefix, scopes, last_used_at, created_at, expires_at')
      .eq('user_id', agent.owner_user_id)
      .order('created_at', { ascending: false });

    if (error) return errorResponse(new Error(error.message));

    return successResponse(keys ?? []);
  } catch (err) {
    return errorResponse(err);
  }
}
