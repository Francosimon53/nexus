import { NextRequest } from 'next/server';
import { RateAgentSchema } from '@nexus-protocol/shared';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { emitTrustEvent } from '@/lib/trust-events';
import { AgentNotFoundError, ValidationError } from '@nexus-protocol/shared';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const { agentId } = await params;
    if (!UUID_RE.test(agentId)) return errorResponse(new ValidationError('Invalid agent ID'));

    const body = await request.json();
    const input = RateAgentSchema.parse(body);

    const supabase = getSupabaseAdmin();

    // Validate agent exists
    const { data: agent, error: agentErr } = await supabase
      .from('agents')
      .select('id')
      .eq('id', agentId)
      .single();

    if (agentErr || !agent) return errorResponse(new AgentNotFoundError(agentId));

    // Validate task exists and was assigned to this agent
    const { data: task, error: taskErr } = await supabase
      .from('tasks')
      .select('id, assigned_agent_id, status')
      .eq('id', input.taskId)
      .single();

    if (taskErr || !task) {
      return errorResponse(new ValidationError('Task not found'));
    }
    if (task.assigned_agent_id !== agentId) {
      return errorResponse(new ValidationError('Task was not assigned to this agent'));
    }
    if (task.status !== 'completed') {
      return errorResponse(new ValidationError('Can only rate completed tasks'));
    }

    // Check for duplicate rating
    const { data: existing } = await supabase
      .from('trust_events')
      .select('id')
      .eq('agent_id', agentId)
      .eq('task_id', input.taskId)
      .eq('event_type', 'rating_received')
      .limit(1);

    if (existing && existing.length > 0) {
      return errorResponse(new ValidationError('Task already rated'));
    }

    // Store rating as trust event (score = rating value 1-5 for averaging)
    await emitTrustEvent(supabase, {
      agentId,
      eventType: 'rating_received',
      score: input.rating,
      reason: input.comment || `Rated ${input.rating}/5`,
      taskId: input.taskId,
    });

    return successResponse({ rated: true, rating: input.rating }, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
