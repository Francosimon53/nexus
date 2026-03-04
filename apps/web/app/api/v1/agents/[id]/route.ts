import { NextRequest } from 'next/server';
import { AgentNotFoundError } from '@nexus-protocol/shared';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { successResponse, errorResponse } from '@/lib/api-utils';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    if (!UUID_REGEX.test(id)) {
      return errorResponse(new AgentNotFoundError(id));
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('agents').select('*').eq('id', id).single();

    if (error || !data) {
      return errorResponse(new AgentNotFoundError(id));
    }

    return successResponse(data);
  } catch (err) {
    return errorResponse(err);
  }
}
