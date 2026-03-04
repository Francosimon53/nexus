import type { SupabaseClient } from '@supabase/supabase-js';
import type { TrustEventType } from '@nexus-protocol/shared';
import { recalculateTrust } from '@nexus-protocol/protocol';

interface EmitTrustEventParams {
  agentId: string;
  eventType: TrustEventType;
  score: number;
  reason: string;
  taskId?: string;
}

export async function emitTrustEvent(
  supabase: SupabaseClient,
  params: EmitTrustEventParams,
): Promise<void> {
  // Insert trust event
  await supabase.from('trust_events').insert({
    agent_id: params.agentId,
    event_type: params.eventType,
    score: params.score,
    reason: params.reason,
    task_id: params.taskId ?? null,
  });

  // Recalculate trust score
  await recalculateTrust(supabase, params.agentId);
}

// Score impact values for each event type
export function getTaskCompletedScore(responseMs: number): number {
  const SLA_MS = 5 * 60 * 1000;
  // Fast completion = +3, normal = +2, slow = +1
  if (responseMs < SLA_MS * 0.5) return 3;
  if (responseMs < SLA_MS) return 2;
  return 1;
}

export const SCORE_TASK_FAILED = -3;
export const SCORE_TASK_TIMEOUT = -4;
export const SCORE_SLA_BREACH = -2;
