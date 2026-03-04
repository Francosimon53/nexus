import { NextRequest } from 'next/server';
import { TaskReplySchema } from '@nexus-protocol/shared';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { forwardToAgent } from '@/lib/agent-forwarder';
import { emitTrustEvent, getTaskCompletedScore, SCORE_SLA_BREACH } from '@/lib/trust-events';
import { TaskNotFoundError, ValidationError } from '@nexus-protocol/shared';
import type { A2AMessage, A2AArtifact } from '@nexus-protocol/shared';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) return errorResponse(new ValidationError('Invalid task ID'));

    const body = await request.json();
    const input = TaskReplySchema.parse(body);

    const supabase = getSupabaseAdmin();

    const { data: task, error } = await supabase
      .from('tasks')
      .select('*, agents!tasks_assigned_agent_id_fkey(endpoint)')
      .eq('id', id)
      .single();

    if (error || !task) return errorResponse(new TaskNotFoundError(id));

    if (task.status !== 'running' && task.status !== 'assigned') {
      return errorResponse(
        new ValidationError(`Cannot reply to task with status: ${task.status}`),
      );
    }

    const existingMessages = (task.messages ?? []) as A2AMessage[];
    const existingArtifacts = (task.artifacts ?? []) as A2AArtifact[];

    // Append new message
    const messages = [...existingMessages, input.message];
    const artifacts = input.artifacts
      ? [...existingArtifacts, ...input.artifacts]
      : existingArtifacts;

    // Forward reply to agent
    const agent = task.agents as { endpoint: string } | null;
    if (!agent?.endpoint) {
      return errorResponse(new Error('Agent endpoint not found'));
    }

    try {
      const result = await forwardToAgent(agent.endpoint, id, input.message);

      const updatedMessages = [...messages, ...(result.messages ?? [])];
      const updatedArtifacts = [...artifacts, ...(result.artifacts ?? [])];

      const { data: updated, error: updateErr } = await supabase
        .from('tasks')
        .update({
          status: result.status === 'completed' ? 'completed' : 'running',
          messages: updatedMessages,
          artifacts: updatedArtifacts,
          completed_at: result.status === 'completed' ? new Date().toISOString() : null,
        })
        .eq('id', id)
        .select('*')
        .single();

      if (updateErr) return errorResponse(new Error(updateErr.message));

      // Emit trust event on completion
      if (result.status === 'completed' && task.assigned_agent_id) {
        const responseMs = Date.now() - new Date(task.created_at as string).getTime();
        const SLA_MS = 5 * 60 * 1000;
        await emitTrustEvent(supabase, {
          agentId: task.assigned_agent_id as string,
          eventType: 'task_completed',
          score: getTaskCompletedScore(responseMs),
          reason: `Task completed in ${Math.round(responseMs / 1000)}s`,
          taskId: id,
        });
        if (responseMs > SLA_MS) {
          await emitTrustEvent(supabase, {
            agentId: task.assigned_agent_id as string,
            eventType: 'sla_breach',
            score: SCORE_SLA_BREACH,
            reason: `Response time ${Math.round(responseMs / 1000)}s exceeded 5m SLA`,
            taskId: id,
          });
        }
      }

      return successResponse(updated);
    } catch (fwdErr) {
      // Save the message even if forward fails
      await supabase
        .from('tasks')
        .update({ messages, artifacts, retry_count: (task.retry_count ?? 0) + 1 })
        .eq('id', id);

      return errorResponse(fwdErr);
    }
  } catch (err) {
    return errorResponse(err);
  }
}
