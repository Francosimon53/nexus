import { NextRequest } from 'next/server';
import { HeartbeatSchema, AgentNotFoundError } from '@nexus-protocol/shared';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { successResponse, errorResponse } from '@/lib/api-utils';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    if (!UUID_REGEX.test(id)) {
      return errorResponse(new AgentNotFoundError(id));
    }

    let body = {};
    try {
      body = await request.json();
    } catch {
      // empty body is fine
    }

    const input = HeartbeatSchema.parse(body);

    const supabase = getSupabaseAdmin();
    const updates: Record<string, unknown> = {
      last_heartbeat: new Date().toISOString(),
    };

    if (input.status) {
      updates['status'] = input.status;
    }

    if (input.metadata) {
      updates['metadata'] = input.metadata;
    }

    const { data, error } = await supabase
      .from('agents')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !data) {
      return errorResponse(new AgentNotFoundError(id));
    }

    return successResponse(data);
  } catch (err) {
    return errorResponse(err);
  }
}
