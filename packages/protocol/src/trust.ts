import type { SupabaseClient } from '@supabase/supabase-js';
import type { TrustComponents } from '@nexus-protocol/shared';
import { TRUST_WEIGHTS } from '@nexus-protocol/shared';

// ── Trust Score Computation ──────────────────────────────────────────────────

const TENURE_MAX_DAYS = 365;

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

interface TaskStats {
  total: number;
  completed: number;
  failed: number;
  avgResponseMs: number | null;
}

interface RatingStats {
  avgRating: number | null;
  count: number;
}

async function getTaskStats(
  supabase: SupabaseClient,
  agentId: string,
): Promise<TaskStats> {
  const { data: tasks } = await supabase
    .from('tasks')
    .select('status, created_at, completed_at')
    .eq('assigned_agent_id', agentId)
    .in('status', ['completed', 'failed', 'cancelled']);

  if (!tasks || tasks.length === 0) {
    return { total: 0, completed: 0, failed: 0, avgResponseMs: null };
  }

  let completed = 0;
  let failed = 0;
  let totalResponseMs = 0;
  let responseCount = 0;

  for (const t of tasks) {
    if (t.status === 'completed') {
      completed++;
      if (t.created_at && t.completed_at) {
        const ms = new Date(t.completed_at as string).getTime() - new Date(t.created_at as string).getTime();
        if (ms > 0) {
          totalResponseMs += ms;
          responseCount++;
        }
      }
    } else {
      failed++;
    }
  }

  return {
    total: tasks.length,
    completed,
    failed,
    avgResponseMs: responseCount > 0 ? totalResponseMs / responseCount : null,
  };
}

async function getRatingStats(
  supabase: SupabaseClient,
  agentId: string,
): Promise<RatingStats> {
  // Ratings are stored as trust_events with event_type='rating_received'.
  // The score field stores the 1-5 rating value (validated by RateAgentSchema).
  // Other event types use the broader -10 to 10 range but are NOT included here.
  const { data: events } = await supabase
    .from('trust_events')
    .select('score')
    .eq('agent_id', agentId)
    .eq('event_type', 'rating_received');

  if (!events || events.length === 0) {
    return { avgRating: null, count: 0 };
  }

  // Clamp each rating to 1-5 defensively (score column allows wider range for other event types)
  const ratings = events.map((e) => Math.min(5, Math.max(1, Number(e.score))));
  const sum = ratings.reduce((acc, r) => acc + r, 0);
  return { avgRating: sum / ratings.length, count: ratings.length };
}

export function computeComponents(
  taskStats: TaskStats,
  ratingStats: RatingStats,
  agentCreatedAt: string,
): TrustComponents {
  // Reliability (40%): completed / total tasks
  let reliability = 50; // default for new agents
  if (taskStats.total > 0) {
    reliability = clamp((taskStats.completed / taskStats.total) * 100);
  }

  // Speed (20%): avg response time vs 5-minute SLA baseline
  // Continuous linear scale: 0ms → 100, at SLA → 50, at 2x SLA → 0
  const SLA_MS = 5 * 60 * 1000; // 5 minutes
  let speed = 50;
  if (taskStats.avgResponseMs !== null) {
    const ratio = taskStats.avgResponseMs / SLA_MS;
    speed = clamp(100 - ratio * 50);
  }

  // Quality (25%): average rating normalized to 0-100
  let quality = 50;
  if (ratingStats.avgRating !== null) {
    // 1-star = 0, 5-star = 100
    quality = clamp(((ratingStats.avgRating - 1) / 4) * 100);
  }

  // Tenure (15%): age on platform (capped at TENURE_MAX_DAYS)
  const ageDays = (Date.now() - new Date(agentCreatedAt).getTime()) / (1000 * 60 * 60 * 24);
  const tenure = clamp((ageDays / TENURE_MAX_DAYS) * 100);

  return { reliability, speed, quality, tenure };
}

export function computeTrustScore(components: TrustComponents): number {
  const score =
    components.reliability * TRUST_WEIGHTS.reliability +
    components.speed * TRUST_WEIGHTS.speed +
    components.quality * TRUST_WEIGHTS.quality +
    components.tenure * TRUST_WEIGHTS.tenure;
  return Math.round(clamp(score));
}

// ── Full Recalculation ───────────────────────────────────────────────────────

export interface TrustProfile {
  trustScore: number;
  components: TrustComponents;
  taskStats: { total: number; completed: number; failed: number };
  ratingStats: { avgRating: number | null; count: number };
}

export async function recalculateTrust(
  supabase: SupabaseClient,
  agentId: string,
): Promise<TrustProfile> {
  // Fetch agent creation date and existing metadata
  const { data: agent } = await supabase
    .from('agents')
    .select('created_at, metadata')
    .eq('id', agentId)
    .single();

  const createdAt = (agent?.created_at as string) ?? new Date().toISOString();
  const existingMetadata = (agent?.metadata as Record<string, unknown>) ?? {};

  const [taskStats, ratingStats] = await Promise.all([
    getTaskStats(supabase, agentId),
    getRatingStats(supabase, agentId),
  ]);

  const components = computeComponents(taskStats, ratingStats, createdAt);
  const trustScore = computeTrustScore(components);

  // Persist to agents table (merge into existing metadata)
  await supabase
    .from('agents')
    .update({
      trust_score: trustScore,
      metadata: {
        ...existingMetadata,
        trust_components: components,
      },
    })
    .eq('id', agentId);

  return {
    trustScore,
    components,
    taskStats: { total: taskStats.total, completed: taskStats.completed, failed: taskStats.failed },
    ratingStats: { avgRating: ratingStats.avgRating, count: ratingStats.count },
  };
}
