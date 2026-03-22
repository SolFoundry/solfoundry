import { useTreasuryStats } from '../../hooks/useTreasuryStats';
import { SkeletonGrid } from '../common/Skeleton';

/** Format a number for display: 1B / 200M / 10K / locale string. */
const fmt = (n: number) => n >= 1e9 ? `${(n/1e9).toFixed(1)}B` : n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `${(n/1e3).toFixed(1)}K` : n.toLocaleString();

/** Percentage with one decimal place; returns '0.0' when total is 0. */
const pct = (n: number, total: number) => total > 0 ? ((n / total) * 100).toFixed(1) : '0.0';

/** Single metric card used throughout the tokenomics dashboard. */
function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-100 p-4">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

/** Stacked horizontal bar showing token distribution breakdown with a legend. */
function DistributionBar({ data, total }: { data: Record<string, number>; total: number }) {
  const items = Object.entries(data).filter(([, v]) => v > 0);
  const colors = ['bg-[#00FF88]', 'bg-[#9945FF]', 'bg-blue-500', 'bg-orange-500'];
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-100 p-4" role="figure" aria-label="Token distribution">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Distribution</h3>
      <div className="flex h-4 rounded-full overflow-hidden bg-gray-100 dark:bg-surface-200">
        {items.map(([k, v], i) => (
          <div key={k} className={`${colors[i % colors.length]} h-full`} style={{ width: `${pct(v, total)}%` }} title={`${k}: ${fmt(v)}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-3 mt-3">
        {items.map(([k, v], i) => (
          <span key={k} className="text-xs text-gray-400 flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${colors[i % colors.length]}`} /> {k.replace(/_/g, ' ')}: {fmt(v)} ({pct(v, total)}%)
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * $FNDRY Tokenomics dashboard page.
 *
 * Displays live supply metrics, treasury balances, distribution chart, and
 * buyback/burn stats. Data is fetched via {@link useTreasuryStats} with
 * graceful fallback to mock data when the API is unavailable.
 *
 * Integrated into the app via Sidebar nav link at `/tokenomics` and
 * re-exported through `pages/TokenomicsPage.tsx` for the router.
 */
export function TokenomicsPage() {
  const { tokenomics: t, treasury: tr, loading, error } = useTreasuryStats();

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6" role="status">
        <div className="text-center text-gray-400 mb-4">Loading tokenomics...</div>
        <SkeletonGrid count={6} />
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-8 text-center" role="alert">
        <p className="text-red-400 font-semibold mb-2">Failed to load treasury data</p>
        <p className="text-sm text-gray-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t.tokenName} Tokenomics</h1>
        <p className="text-sm text-gray-400 mt-1">Contract: <code className="text-xs">{t.tokenCA}</code></p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Supply" value={fmt(t.totalSupply)} />
        <StatCard label="Circulating" value={fmt(t.circulatingSupply)} sub={`${pct(t.circulatingSupply, t.totalSupply)}% of supply`} />
        <StatCard label="Treasury" value={fmt(t.treasuryHoldings)} sub={`${tr.solBalance.toFixed(2)} SOL`} />
        <StatCard label="Distributed" value={fmt(t.totalDistributed)} sub={`${tr.totalPayouts} payouts`} />
      </div>
      <DistributionBar data={t.distributionBreakdown} total={t.totalSupply} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Buybacks" value={fmt(t.totalBuybacks)} sub={`${t.feeRevenueSol.toFixed(2)} SOL revenue`} />
        <StatCard label="Total Burned" value={fmt(t.totalBurned)} />
        <StatCard label="Treasury Wallet" value={tr.treasuryWallet.slice(0, 8) + '...'} sub={`${tr.solBalance.toFixed(2)} SOL / ${fmt(tr.fndryBalance)} FNDRY`} />
      </div>
      <p className="text-xs text-gray-500 text-right">Last updated: {new Date(t.lastUpdated).toLocaleString()}</p>
    </div>
  );
}
export default TokenomicsPage;
