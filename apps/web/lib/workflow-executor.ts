import type { SupabaseClient } from '@supabase/supabase-js';
import type { WorkflowStep, StepResult } from '@nexus-protocol/shared';
import { forwardToAgent } from './agent-forwarder';
import { emitTrustEvent, getTaskCompletedScore, SCORE_TASK_FAILED } from './trust-events';
import { settleTask } from './billing';
import type { A2AMessage } from '@nexus-protocol/shared';

interface WorkflowRow {
  id: string;
  name: string;
  owner_user_id: string;
  steps: WorkflowStep[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Return indices of steps that are ready to execute (all dependencies completed).
 */
function getReadySteps(
  steps: WorkflowStep[],
  completedIndices: Set<number>,
  runningIndices: Set<number>,
): number[] {
  const ready: number[] = [];
  for (let i = 0; i < steps.length; i++) {
    if (completedIndices.has(i) || runningIndices.has(i)) continue;
    const deps = steps[i]!.dependsOn ?? [];
    if (deps.every((d) => completedIndices.has(d))) {
      ready.push(i);
    }
  }
  return ready;
}

async function getSystemAgentId(supabase: SupabaseClient): Promise<string> {
  if (process.env['SYSTEM_AGENT_ID']) return process.env['SYSTEM_AGENT_ID'];
  const { data } = await supabase
    .from('agents')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();
  if (!data) throw new Error('No agents registered');
  return data.id as string;
}

/**
 * Execute a single workflow step with retries.
 */
async function executeStep(
  supabase: SupabaseClient,
  step: WorkflowStep,
  stepIndex: number,
  runId: string,
  stepResults: StepResult[],
  requesterAgentId: string,
): Promise<StepResult> {
  const result: StepResult = {
    stepIndex,
    status: 'running',
    taskId: null,
    output: null,
    error: null,
    startedAt: new Date().toISOString(),
    completedAt: null,
  };

  const { data: agent } = await supabase
    .from('agents')
    .select('id, endpoint, status, price_per_task')
    .eq('id', step.agentId)
    .single();

  if (!agent) {
    result.status = 'failed';
    result.error = `Agent ${step.agentId} not found`;
    result.completedAt = new Date().toISOString();
    return result;
  }

  // Gather input: merge step input with outputs from dependencies
  const mergedInput = { ...step.input };
  for (const depIdx of step.dependsOn ?? []) {
    const depResult = stepResults[depIdx];
    if (depResult?.output) {
      Object.assign(mergedInput, { [`step_${depIdx}_output`]: depResult.output });
    }
  }

  // Create a task for this step
  const timeoutAt = new Date(Date.now() + step.timeout * 1000).toISOString();
  const { data: task, error: taskErr } = await supabase
    .from('tasks')
    .insert({
      title: `[Workflow] ${step.name}`,
      description: `Workflow run ${runId}, step ${stepIndex}`,
      status: 'assigned',
      requester_agent_id: requesterAgentId,
      assigned_agent_id: step.agentId,
      input: mergedInput,
      timeout_at: timeoutAt,
    })
    .select('*')
    .single();

  if (taskErr || !task) {
    result.status = 'failed';
    result.error = taskErr?.message ?? 'Failed to create task';
    result.completedAt = new Date().toISOString();
    return result;
  }

  result.taskId = task.id as string;

  const maxRetries = step.retryPolicy?.maxRetries ?? 0;
  const backoffMs = step.retryPolicy?.backoffMs ?? 1000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await sleep(backoffMs * Math.pow(2, attempt - 1));
    }

    try {
      const userMessage: A2AMessage = {
        role: 'user',
        parts: [{ type: 'text', data: JSON.stringify(mergedInput) }],
      };

      const fwdResult = await forwardToAgent(
        agent.endpoint as string,
        task.id as string,
        userMessage,
      );

      const now = new Date().toISOString();
      const isCompleted = fwdResult.status === 'completed';

      await supabase
        .from('tasks')
        .update({
          status: isCompleted ? 'completed' : 'running',
          messages: fwdResult.messages ?? [],
          artifacts: fwdResult.artifacts ?? [],
          output: fwdResult.artifacts?.[0]?.parts?.[0]?.data
            ? { result: fwdResult.artifacts[0].parts[0].data }
            : null,
          completed_at: isCompleted ? now : null,
        })
        .eq('id', task.id);

      if (isCompleted) {
        result.status = 'completed';
        result.output = fwdResult.artifacts?.[0]?.parts?.[0]?.data
          ? { result: fwdResult.artifacts[0].parts[0].data }
          : {};
        result.completedAt = now;

        // Trust event
        const responseMs = Date.now() - new Date(task.created_at as string).getTime();
        await emitTrustEvent(supabase, {
          agentId: step.agentId,
          eventType: 'task_completed',
          score: getTaskCompletedScore(responseMs),
          reason: `Workflow step completed in ${Math.round(responseMs / 1000)}s`,
          taskId: task.id as string,
        });

        // Settle billing
        const price = Number(agent.price_per_task ?? 0);
        if (price > 0) {
          try {
            await settleTask(supabase, task.id as string, requesterAgentId, step.agentId, price);
          } catch (e) {
            console.error('Billing settlement failed (non-fatal):', e);
          }
        }

        return result;
      }

      // Not completed but no error — treat as still running, keep retrying
    } catch (err) {
      if (attempt === maxRetries) {
        const errMsg = err instanceof Error ? err.message : String(err);
        result.status = 'failed';
        result.error = errMsg;
        result.completedAt = new Date().toISOString();

        await supabase
          .from('tasks')
          .update({
            status: 'failed',
            error_message: errMsg,
            completed_at: new Date().toISOString(),
          })
          .eq('id', task.id);

        await emitTrustEvent(supabase, {
          agentId: step.agentId,
          eventType: 'task_failed',
          score: SCORE_TASK_FAILED,
          reason: `Workflow step failed: ${errMsg}`,
          taskId: task.id as string,
        });

        return result;
      }
    }
  }

  // Shouldn't reach here, but safety
  result.status = 'failed';
  result.error = 'Max retries exhausted';
  result.completedAt = new Date().toISOString();
  return result;
}

/**
 * Execute a full workflow: walk the DAG, execute steps in dependency order.
 */
export async function executeWorkflow(
  supabase: SupabaseClient,
  workflow: WorkflowRow,
  runId: string,
): Promise<void> {
  const steps = workflow.steps;
  const stepResults: StepResult[] = steps.map((_, i) => ({
    stepIndex: i,
    status: 'pending' as const,
    taskId: null,
    output: null,
    error: null,
    startedAt: null,
    completedAt: null,
  }));

  // Update run to running
  await supabase
    .from('workflow_runs')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', runId);

  const completedIndices = new Set<number>();
  const failedIndices = new Set<number>();
  const requesterAgentId = await getSystemAgentId(supabase);

  while (completedIndices.size + failedIndices.size < steps.length) {
    const runningIndices = new Set<number>();
    const ready = getReadySteps(steps, completedIndices, runningIndices);
    if (ready.length === 0) break; // Deadlock or all done

    // Execute independent steps in parallel
    for (const idx of ready) runningIndices.add(idx);

    const settled = await Promise.allSettled(
      ready.map((idx) =>
        executeStep(supabase, steps[idx]!, idx, runId, stepResults, requesterAgentId)
          .then((result) => ({ idx, result })),
      ),
    );

    for (const outcome of settled) {
      const { idx, result } =
        outcome.status === 'fulfilled'
          ? outcome.value
          : { idx: -1, result: null };

      if (!result || idx === -1) continue;

      stepResults[idx] = result;

      if (result.status === 'completed') {
        completedIndices.add(idx);
      } else {
        failedIndices.add(idx);
        // Mark downstream steps as skipped
        for (let j = 0; j < steps.length; j++) {
          if (steps[j]!.dependsOn?.includes(idx) && !completedIndices.has(j) && !failedIndices.has(j)) {
            const existing = stepResults[j]!;
            stepResults[j] = {
              ...existing,
              status: 'skipped',
              error: `Skipped: dependency step ${idx} failed`,
              completedAt: new Date().toISOString(),
            };
            failedIndices.add(j);
          }
        }
      }
    }

    // Update step_results progressively
    await supabase
      .from('workflow_runs')
      .update({ step_results: stepResults })
      .eq('id', runId);
  }

  // Determine final status
  const allCompleted = completedIndices.size === steps.length;
  const now = new Date().toISOString();

  await supabase
    .from('workflow_runs')
    .update({
      status: allCompleted ? 'completed' : 'failed',
      completed_at: now,
      step_results: stepResults,
      error: allCompleted
        ? null
        : `${failedIndices.size} step(s) failed`,
    })
    .eq('id', runId);
}
