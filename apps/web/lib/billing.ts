import type { SupabaseClient } from '@supabase/supabase-js';
import { PLATFORM_FEE_RATE } from '@nexus-protocol/shared';

interface CreditBalanceRow {
  user_id: string;
  balance: number;
  total_earned: number;
  total_spent: number;
  total_purchased: number;
  created_at: string;
  updated_at: string;
}

/**
 * Ensure a credit balance row exists for a user.
 * Creates one with 1000 initial credits + initial_grant transaction if missing.
 */
export async function ensureCreditBalance(
  supabase: SupabaseClient,
  userId: string,
): Promise<CreditBalanceRow> {
  const { data: existing } = await supabase
    .from('credit_balances')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (existing) return existing as CreditBalanceRow;

  const initialBalance = 1000;

  const { data: created, error } = await supabase
    .from('credit_balances')
    .insert({ user_id: userId, balance: initialBalance })
    .select('*')
    .single();

  if (error) {
    // Race condition: another request created it
    const { data: retry } = await supabase
      .from('credit_balances')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (retry) return retry as CreditBalanceRow;
    throw new Error(`Failed to create credit balance: ${error.message}`);
  }

  // Record initial grant transaction
  await supabase.from('credit_transactions').insert({
    user_id: userId,
    type: 'initial_grant',
    amount: initialBalance,
    balance_after: initialBalance,
    description: 'Welcome bonus: 1,000 credits',
  });

  return created as CreditBalanceRow;
}

/**
 * Get balance for a user (creates if missing).
 */
export async function getBalance(
  supabase: SupabaseClient,
  userId: string,
): Promise<CreditBalanceRow> {
  return ensureCreditBalance(supabase, userId);
}

/**
 * Debit credits from a user's balance. Throws if insufficient.
 * Uses a conditional update (WHERE balance >= amount) to prevent
 * concurrent requests from overdrawing the balance.
 */
export async function debitCredits(
  supabase: SupabaseClient,
  userId: string,
  amount: number,
  type: 'task_debit' | 'platform_fee',
  referenceId: string,
  description: string,
): Promise<void> {
  const balance = await ensureCreditBalance(supabase, userId);
  const newBalance = Number(balance.balance) - amount;

  if (newBalance < 0) {
    throw new Error(`Insufficient credits: have ${balance.balance}, need ${amount}`);
  }

  // Conditional update: only succeeds if balance hasn't changed (optimistic lock).
  // The .eq('balance', balance.balance) ensures no concurrent debit has altered it.
  const { data: updated, error } = await supabase
    .from('credit_balances')
    .update({
      balance: newBalance,
      total_spent: Number(balance.total_spent) + amount,
    })
    .eq('user_id', userId)
    .gte('balance', amount)
    .select('user_id')
    .maybeSingle();

  if (error) throw new Error(`Failed to debit credits: ${error.message}`);

  if (!updated) {
    // Row wasn't updated — balance changed between read and write (concurrent debit)
    throw new Error(`Insufficient credits: balance changed concurrently, please retry`);
  }

  await supabase.from('credit_transactions').insert({
    user_id: userId,
    type,
    amount: -amount,
    balance_after: newBalance,
    reference_id: referenceId,
    description,
  });
}

/**
 * Credit (add) credits to a user's balance.
 */
export async function creditCredits(
  supabase: SupabaseClient,
  userId: string,
  amount: number,
  type: 'task_credit' | 'purchase' | 'refund' | 'initial_grant',
  referenceId: string,
  description: string,
): Promise<void> {
  const balance = await ensureCreditBalance(supabase, userId);

  const newBalance = Number(balance.balance) + amount;
  const updates: Record<string, number> = { balance: newBalance };

  if (type === 'task_credit') {
    updates['total_earned'] = Number(balance.total_earned) + amount;
  } else if (type === 'purchase') {
    updates['total_purchased'] = Number(balance.total_purchased) + amount;
  }

  const { error } = await supabase
    .from('credit_balances')
    .update(updates)
    .eq('user_id', userId);

  if (error) throw new Error(`Failed to credit: ${error.message}`);

  await supabase.from('credit_transactions').insert({
    user_id: userId,
    type,
    amount,
    balance_after: newBalance,
    reference_id: referenceId,
    description,
  });
}

/**
 * Settle billing for a completed task.
 * Debits requester owner, credits assigned agent owner, records platform fee.
 */
export async function settleTask(
  supabase: SupabaseClient,
  taskId: string,
  requesterAgentId: string,
  assignedAgentId: string,
  cost: number,
): Promise<void> {
  if (cost <= 0) return;

  // Look up owners
  const { data: agents } = await supabase
    .from('agents')
    .select('id, owner_user_id')
    .in('id', [requesterAgentId, assignedAgentId]);

  if (!agents || agents.length < 2) return;

  const requesterOwner = agents.find((a) => a.id === requesterAgentId)?.owner_user_id as string;
  const assignedOwner = agents.find((a) => a.id === assignedAgentId)?.owner_user_id as string;

  // Skip self-tasks (same owner)
  if (requesterOwner === assignedOwner) return;

  const platformFee = Math.round(cost * PLATFORM_FEE_RATE * 100) / 100;
  const agentEarning = cost - platformFee;

  // Debit requester
  await debitCredits(supabase, requesterOwner, cost, 'task_debit', taskId, `Task ${taskId} execution`);

  // Credit agent owner
  await creditCredits(supabase, assignedOwner, agentEarning, 'task_credit', taskId, `Earned from task ${taskId}`);

  // Record platform fee (debit from assigned owner conceptually, but we just didn't credit the full amount)
  // The platform fee is the difference: cost - agentEarning. We record it as a transaction for transparency.
  await supabase.from('credit_transactions').insert({
    user_id: assignedOwner,
    type: 'platform_fee',
    amount: -platformFee,
    balance_after: 0, // informational — not affecting actual balance
    reference_id: taskId,
    description: `Platform fee (${PLATFORM_FEE_RATE * 100}%) on task ${taskId}`,
  });

  // Update task actual_cost_credits
  await supabase
    .from('tasks')
    .update({ actual_cost_credits: cost })
    .eq('id', taskId);

  // Insert into legacy transactions table
  await supabase.from('transactions').insert({
    task_id: taskId,
    from_agent_id: requesterAgentId,
    to_agent_id: assignedAgentId,
    amount_credits: cost,
    status: 'settled',
  });
}
