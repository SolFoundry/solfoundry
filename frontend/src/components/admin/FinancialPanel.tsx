/** Financial overview panel — token distribution and payout history. */
import { useState } from 'react';
import { useFinancialOverview, usePayoutHistory } from '../../hooks/useAdminData';
import { WalletAddress } from '../wallet/WalletAddress';

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function FinancialPanel() {
  const [page, setPage] = useState(1);
  const { data: overview, isLoading: ovLoading } = useFinancialOverview();
  const { data: payouts, isLoading: payLoading } = usePayoutHistory(page, 20);

  const totalPages = payouts ? Math.ceil(payouts.total / 20) : 1;

  return (
    <div className="p-6 space-y-6" data-testid="financial-panel">
      <h2 className="text-lg font-semibold">Financial Overview</h2>

      {/* Summary cards */}
      {ovLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      )}

      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: 'Total $FNDRY Distributed', value: fmt(overview.total_fndry_distributed), accent: 'text-[#14F195]' },
            { label: 'Paid Bounties', value: overview.total_paid_bounties },
            { label: 'Avg Reward', value: fmt(overview.avg_reward), accent: 'text-[#9945FF]' },
            { label: 'Highest Reward', value: fmt(overview.highest_reward) },
            { label: 'Pending Payouts', value: overview.pending_payout_count, accent: overview.pending_payout_count > 0 ? 'text-yellow-400' : 'text-white' },
            { label: 'Pending Amount', value: fmt(overview.pending_payout_amount), accent: 'text-yellow-400' },
          ].map(({ label, value, accent = 'text-white' }) => (
            <div key={label} className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className={`text-xl font-bold tabular-nums ${accent}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Payout history table */}
      <div>
        <h3 className="text-sm font-medium text-gray-400 mb-3">Payout History</h3>

        {payLoading && (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 rounded-lg bg-white/[0.03] animate-pulse" />
            ))}
          </div>
        )}

        {payouts && payouts.items.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-12">No payouts yet</p>
        )}

        {payouts && payouts.items.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-white/5">
            <table className="w-full text-xs" data-testid="payout-table">
              <thead>
                <tr className="border-b border-white/5 text-gray-500">
                  <th className="text-left px-4 py-3 font-medium">Bounty</th>
                  <th className="text-left px-4 py-3 font-medium">Winner</th>
                  <th className="text-right px-4 py-3 font-medium">Amount</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {payouts.items.map((p, i) => (
                  <tr
                    key={`${p.bounty_id}-${i}`}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-3 font-medium truncate max-w-[200px]">
                      <a href={`/bounties/${p.bounty_id}`} className="text-[#9945FF] hover:underline">
                        {p.bounty_title}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-gray-400 truncate max-w-[140px]">
                      {p.winner ? <WalletAddress address={p.winner} startChars={4} endChars={4} className="inline-flex" /> : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[#14F195] font-medium">
                      {fmt(p.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        p.status === 'paid' ? 'text-[#14F195] bg-[#14F195]/10' : 'text-gray-400 bg-white/5'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {p.completed_at ? new Date(p.completed_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-3">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-white/10 px-3 py-1 text-xs text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
            >
              ← Prev
            </button>
            <span className="text-xs text-gray-500">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-white/10 px-3 py-1 text-xs text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
