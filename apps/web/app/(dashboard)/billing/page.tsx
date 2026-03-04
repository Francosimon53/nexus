export const dynamic = 'force-dynamic';

import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { ensureCreditBalance } from '@/lib/billing';
import { BalanceCard } from './components/balance-card';
import { BuyCredits } from './components/buy-credits';
import { TransactionHistory } from './components/transaction-history';
import { UsageChart } from './components/usage-chart';

// TODO(phase-2): Replace admin client with authenticated SSR client
const DEMO_USER_ID = process.env['DEMO_USER_ID'] ?? '00000000-0000-0000-0000-000000000000';

async function getUsageForPeriod(supabase: ReturnType<typeof getSupabaseAdmin>, userId: string, days: number) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data: transactions } = await supabase
    .from('credit_transactions')
    .select('type, amount, created_at')
    .eq('user_id', userId)
    .gte('created_at', since)
    .order('created_at', { ascending: true });

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

  return {
    daily,
    totalSpent: daily.reduce((s, d) => s + d.spent, 0),
    totalEarned: daily.reduce((s, d) => s + d.earned, 0),
  };
}

export default async function BillingPage() {
  const supabase = getSupabaseAdmin();

  // Get or create balance
  let balance;
  try {
    balance = await ensureCreditBalance(supabase, DEMO_USER_ID);
  } catch {
    balance = { balance: 0, total_earned: 0, total_spent: 0, total_purchased: 0 };
  }

  // Get recent transactions
  const { data: transactions } = await supabase
    .from('credit_transactions')
    .select('*')
    .eq('user_id', DEMO_USER_ID)
    .order('created_at', { ascending: false })
    .limit(20);

  // Get usage data for all periods
  const [usage7d, usage30d, usage90d] = await Promise.all([
    getUsageForPeriod(supabase, DEMO_USER_ID, 7),
    getUsageForPeriod(supabase, DEMO_USER_ID, 30),
    getUsageForPeriod(supabase, DEMO_USER_ID, 90),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Billing</h1>
      <p className="text-text-secondary mb-8">Track credits, transactions, and usage across agents.</p>

      <div className="space-y-8">
        <BalanceCard
          balance={Number(balance.balance)}
          totalEarned={Number(balance.total_earned)}
          totalSpent={Number(balance.total_spent)}
          totalPurchased={Number(balance.total_purchased)}
        />

        <BuyCredits />

        <UsageChart usageData={{ '7d': usage7d, '30d': usage30d, '90d': usage90d }} />

        <TransactionHistory transactions={transactions ?? []} />
      </div>
    </div>
  );
}
