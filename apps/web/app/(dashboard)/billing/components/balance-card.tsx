interface BalanceCardProps {
  balance: number;
  totalEarned: number;
  totalSpent: number;
  totalPurchased: number;
}

export function BalanceCard({ balance, totalEarned, totalSpent, totalPurchased }: BalanceCardProps) {
  const stats = [
    { label: 'Earned', value: totalEarned },
    { label: 'Spent', value: totalSpent },
    { label: 'Purchased', value: totalPurchased },
  ];

  return (
    <div className="rounded-lg border border-border bg-surface-raised p-6">
      <p className="text-sm text-text-secondary">Current Balance</p>
      <p className="mt-1 text-4xl font-bold text-nexus-400">
        {balance.toLocaleString()}
        <span className="ml-2 text-base font-normal text-text-secondary">credits</span>
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="text-xs text-text-secondary">{s.label}</p>
            <p className="text-lg font-semibold">{s.value.toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
