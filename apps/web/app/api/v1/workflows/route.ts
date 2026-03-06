import { NextRequest } from 'next/server';
import { CreateWorkflowSchema } from '@nexus-protocol/shared';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { successResponse, errorResponse } from '@/lib/api-utils';
import { requireApiUser } from '@/lib/api-auth';

/**
 * Validate that the step DAG has no cycles and all dependency indices are valid.
 */
function validateDAG(steps: { dependsOn: number[] }[]): string | null {
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    for (const dep of step.dependsOn) {
      if (dep < 0 || dep >= steps.length) return `Step ${i} depends on invalid index ${dep}`;
      if (dep >= i) return `Step ${i} depends on step ${dep} (must depend on earlier steps)`;
    }
  }

  // Topological sort cycle check
  const visited = new Set<number>();
  const visiting = new Set<number>();

  function dfs(node: number): boolean {
    if (visiting.has(node)) return true; // cycle
    if (visited.has(node)) return false;
    visiting.add(node);
    for (const dep of steps[node]!.dependsOn) {
      if (dfs(dep)) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  }

  for (let i = 0; i < steps.length; i++) {
    if (dfs(i)) return `Cycle detected involving step ${i}`;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireApiUser();
    const body = await request.json();
    const input = CreateWorkflowSchema.parse(body);
    const supabase = getSupabaseAdmin();

    // Validate DAG
    const dagError = validateDAG(input.steps);
    if (dagError) {
      return errorResponse(new Error(dagError));
    }

    // Verify all referenced agents exist
    const agentIds = [...new Set(input.steps.map((s) => s.agentId))];
    const { data: agents } = await supabase
      .from('agents')
      .select('id')
      .in('id', agentIds);

    if (!agents || agents.length !== agentIds.length) {
      const foundIds = new Set(agents?.map((a) => a.id) ?? []);
      const missing = agentIds.filter((id) => !foundIds.has(id));
      return errorResponse(new Error(`Agents not found: ${missing.join(', ')}`));
    }

    const { data: workflow, error } = await supabase
      .from('workflows')
      .insert({
        name: input.name,
        description: input.description,
        owner_user_id: userId,
        steps: input.steps,
      })
      .select('*')
      .single();

    if (error || !workflow) {
      return errorResponse(new Error(error?.message ?? 'Failed to create workflow'));
    }

    return successResponse(workflow, 201);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function GET() {
  try {
    const userId = await requireApiUser();
    const supabase = getSupabaseAdmin();

    const { data: workflows, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('owner_user_id', userId)
      .order('created_at', { ascending: false });

    if (error) return errorResponse(new Error(error.message));

    return successResponse(workflows ?? []);
  } catch (err) {
    return errorResponse(err);
  }
}
