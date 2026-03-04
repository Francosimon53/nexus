interface Transaction {
  id: string;
  type: string;
  amount: number;
  balance_after: number;
  description: string;
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  initial_grant: 'Grant',
  purchase: 'Purchase',
  task_debit: 'Task Cost',
  task_credit: 'Earnings',
  platform_fee: 'Platform Fee',
  refund: 'Refund',
};

const TYPE_COLORS: Record<string, string> = {
  initial_grant: 'bg-blue-500/20 text-blue-400',
  purchase: 'bg-green-500/20 text-green-400',
  task_debit: 'bg-red-500/20 text-red-400',
  task_credit: 'bg-emerald-500/20 text-emerald-400',
  platform_fee: 'bg-yellow-500/20 text-yellow-400',
  refund: 'bg-purple-500/20 text-purple-400',
};

export function TransactionHistory({ transactions }: { transactions: Transaction[] }) {
  if (transactions.length === 0) {
    return (
      <div>
        <h2 className="mb-4 text-lg font-semibold">Transaction History</h2>
        <div className="rounded-lg border border-border bg-surface-raised p-8 text-center text-text-secondary">
          No transactions yet
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Transaction History</h2>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-raised text-left text-text-secondary">
            <tr>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Balance</th>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {transactions.map((tx) => (
              <tr key={tx.id} className="bg-surface">
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[tx.type] ?? 'bg-surface-overlay text-text-secondary'}`}
                  >
                    {TYPE_LABELS[tx.type] ?? tx.type}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={tx.amount >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {tx.amount >= 0 ? '+' : ''}
                    {Number(tx.amount).toLocaleString()}
                  </span>
                </td>
                <td className="px-4 py-3 text-text-secondary">
                  {Number(tx.balance_after).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-text-secondary max-w-xs truncate">
                  {tx.description}
                </td>
                <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                  {new Date(tx.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
