import { NextRequest } from 'next/server';
import { RegisterAgentSchema } from '@nexus-protocol/shared';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { generateAgentCard } from '@/lib/agent-card';
import { requireApiUser } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  try {
    const userId = await requireApiUser();
    const body = await request.json();
    const input = RegisterAgentSchema.parse(body);
    const agentCard = generateAgentCard(input);

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('agents')
      .insert({
        name: input.name,
        description: input.description,
        endpoint: input.endpoint,
        skills: input.skills,
        tags: input.tags,
        metadata: input.metadata,
        price_per_task: input.pricePerTask,
        agent_card: agentCard,
        owner_user_id: userId,
      })
      .select('*')
      .single();

    if (error) {
      console.error('Insert agent error:', error);
      return errorResponse(new Error(error.message));
    }

    return successResponse(data, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
