import { NextRequest } from 'next/server';
import { RegisterAgentSchema } from '@nexus-protocol/shared';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { generateAgentCard } from '@/lib/agent-card';

// TODO(phase-2): Replace admin client with authenticated SSR client
const DEMO_USER_ID = process.env['DEMO_USER_ID'] ?? '00000000-0000-0000-0000-000000000000';

export async function POST(request: NextRequest) {
  try {
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
        owner_user_id: DEMO_USER_ID,
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
