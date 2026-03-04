import { NextRequest } from 'next/server';
import { authenticateApiKey } from '@/lib/api-key-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { BillingUsageQuerySchema } from '@nexus-protocol/shared';
import { successResponse, errorResponse } from '@/lib/api-utils';

const PERIOD_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiKey(request);
    const url = new URL(request.url);
    const { period } = BillingUsageQuerySchema.parse({
      period: url.searchParams.get('period') ?? '30d',
    });

    const days = PERIOD_DAYS[period] ?? 30;
    const since = new Date(Date.now() - days * 86400000).toISOString();

    const supabase = getSupabaseAdmin();

    const { data: transactions } = await supabase
      .from('credit_transactions')
      .select('type, amount, created_at')
      .eq('user_id', auth.userId)
      .gte('created_at', since)
      .order('created_at', { ascending: true });

    // Aggregate by day
    const dailyMap = new Map<string, { spent: number; earned: number }>();
    for (const tx of transactions ?? []) {
      const day = (tx.created_at as string).slice(0, 10);
      const entry = dailyMap.get(day) ?? { spent: 0, earned: 0 };
      const amount = Number(tx.amount);
      if (amount < 0) entry.spent += Math.abs(amount);
      else if (tx.type === 'task_credit') entry.earned += amount;
      dailyMap.set(day, entry);
    }

    const daily = Array.from(dailyMap.entries())
      .map(([date, vals]) => ({ date, ...vals }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const totalSpent = daily.reduce((s, d) => s + d.spent, 0);
    const totalEarned = daily.reduce((s, d) => s + d.earned, 0);

    return successResponse({ period, daily, totalSpent, totalEarned });
  } catch (err) {
    return errorResponse(err);
  }
}
