/**
 * TreasuryPanel — admin-only read-only treasury health dashboard.
 *
 * Features:
 * - Live SOL + FNDRY balance cards
 * - 30-day daily outflow SVG sparkline
 * - Burn-rate projections with runway estimate
 * - Spending breakdown by bounty tier
 * - Recent 20 transactions table with Solscan explorer links
 * - CSV export of recent transactions
 * - 30-second auto-refresh via React Query refetchInterval
 */
import { useTreasuryDashboard } from '../../hooks/useAdminData';
import type { TreasuryDailyPoint, SpendingByTier, TreasuryTransaction } from '../../types/admin';

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function fmtFndry(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function fmtSol(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// SVG sparkline — daily outflow
// ---------------------------------------------------------------------------

interface SparklineProps {
  points: TreasuryDailyPoint[];
  width?: number;
  height?: number;
}

function OutflowSparkline({ points, width = 600, height = 80 }: SparklineProps) {
  if (!points.length) return null;

  const values = points.map(p => p.outflow);
  const maxVal = Math.max(...values, 1);
  const step = width / Math.max(points.length - 1, 1);

  const coords = values.map((v, i) => ({
    x: i * step,
    y: height - (v / maxVal) * (height - 10) - 2,
  }));

  const pathD = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(' ');

  const areaD =
    pathD +
    ` L${coords[coords.length - 1].x.toFixed(1)},${height} L0,${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      style={{ height }}
      aria-label="30-day outflow chart"
      data-testid="outflow-sparkline"
    >
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9945FF" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#9945FF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#sparkGrad)" />
      <path d={pathD} fill="none" stroke="#9945FF" strokeWidth="1.5" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Tier spending bar chart
// ---------------------------------------------------------------------------

interface TierBarsProps {
  tiers: SpendingByTier[];
}

function TierBars({ tiers }: TierBarsProps) {
  const maxVal = Math.max(...tiers.map(t => t.total_fndry), 1);
  const tierColors: Record<number, string> = {
    1: '#14F195',
    2: '#9945FF',
    3: '#FFB800',
  };

  return (
    <div className="space-y-3" data-testid="tier-bars">
      {tiers.map(t => (
        <div key={t.tier}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-400">{t.label}</span>
            <span className="tabular-nums text-white font-medium">
              {fmtFndry(t.total_fndry)} FNDRY
              <span className="text-gray-600 ml-1">({t.count} bounties)</span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/5">
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{
                width: `${(t.total_fndry / maxVal) * 100}%`,
                backgroundColor: tierColors[t.tier] ?? '#9945FF',
              }}
              data-testid={`tier-bar-${t.tier}`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recent transactions table
// ---------------------------------------------------------------------------

interface TxTableProps {
  transactions: TreasuryTransaction[];
}

function TxTable({ transactions }: TxTableProps) {
  if (!transactions.length) {
    return (
      <p className="text-sm text-gray-500 text-center py-10">
        No transactions yet
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/5" data-testid="tx-table">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-white/5 text-gray-500">
            <th className="text-left px-4 py-3 font-medium">Type</th>
            <th className="text-left px-4 py-3 font-medium">Description</th>
            <th className="text-right px-4 py-3 font-medium">Amount</th>
            <th className="text-left px-4 py-3 font-medium">Status</th>
            <th className="text-left px-4 py-3 font-medium">Date</th>
            <th className="text-left px-4 py-3 font-medium">Explorer</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx, i) => (
            <tr
              key={`${tx.id}-${i}`}
              className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
            >
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    tx.type === 'buyback'
                      ? 'text-[#14F195] bg-[#14F195]/10'
                      : 'text-[#9945FF] bg-[#9945FF]/10'
                  }`}
                >
                  {tx.type}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-300 truncate max-w-[200px]">
                {tx.description ?? tx.recipient ?? '—'}
              </td>
              <td className="px-4 py-3 text-right tabular-nums font-medium text-white">
                {tx.type === 'payout'
                  ? `${fmtFndry(tx.amount)} ${tx.token}`
                  : `${fmtSol(tx.amount)} SOL`}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    tx.status === 'confirmed'
                      ? 'text-[#14F195] bg-[#14F195]/10'
                      : tx.status === 'pending'
                      ? 'text-yellow-400 bg-yellow-400/10'
                      : tx.status === 'failed'
                      ? 'text-red-400 bg-red-400/10'
                      : 'text-gray-400 bg-white/5'
                  }`}
                >
                  {tx.status}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-500">{fmtDate(tx.created_at)}</td>
              <td className="px-4 py-3">
                {tx.solscan_url ? (
                  <a
                    href={tx.solscan_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#14F195] hover:underline"
                    data-testid={`tx-explorer-link-${tx.id}`}
                  >
                    Solscan ↗
                  </a>
                ) : (
                  <span className="text-gray-600">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

function exportCsv(transactions: TreasuryTransaction[]): void {
  const header = ['id', 'type', 'amount', 'token', 'description', 'status', 'tx_hash', 'created_at'];
  const rows = transactions.map(tx => [
    tx.id,
    tx.type,
    tx.amount,
    tx.token,
    tx.description ?? tx.recipient ?? '',
    tx.status,
    tx.tx_hash ?? '',
    tx.created_at,
  ]);
  const csv = [header, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `treasury-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function Skeleton({ rows = 3, cols = 2 }: { rows?: number; cols?: number }) {
  return (
    <div className={`grid grid-cols-${cols} gap-4`}>
      {Array.from({ length: rows * cols }).map((_, i) => (
        <div key={i} className="h-20 rounded-xl bg-white/[0.03] animate-pulse" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function TreasuryPanel() {
  const { data, isLoading, isError, dataUpdatedAt, refetch } = useTreasuryDashboard();

  const lastRefresh = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <div className="p-6 space-y-8" data-testid="treasury-panel">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Treasury Dashboard</h2>
          {lastRefresh && (
            <p className="text-xs text-gray-600 mt-0.5">Last updated {lastRefresh} · auto-refreshes every 30s</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <button
              onClick={() => exportCsv(data.recent_transactions)}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:border-white/20 transition-colors"
              data-testid="export-csv-btn"
            >
              Export CSV
            </button>
          )}
          <button
            onClick={() => refetch()}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:border-white/20 transition-colors"
            data-testid="refresh-btn"
          >
            Refresh
          </button>
        </div>
      </div>

      {isLoading && <Skeleton rows={2} cols={3} />}

      {isError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400" data-testid="treasury-error">
          Failed to load treasury data. Check your connection and try again.
        </div>
      )}

      {data && (
        <>
          {/* ── Balance cards ───────────────────────────────────────── */}
          <section aria-label="Balance summary">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-widest mb-3">Balances</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4" data-testid="balance-cards">
              {[
                {
                  label: 'FNDRY Balance',
                  value: `${fmtFndry(data.fndry_balance)} FNDRY`,
                  accent: 'text-[#14F195]',
                  testId: 'fndry-balance',
                },
                {
                  label: 'SOL Balance',
                  value: `${fmtSol(data.sol_balance)} SOL`,
                  accent: 'text-[#9945FF]',
                  testId: 'sol-balance',
                },
                {
                  label: 'Total Payouts',
                  value: data.total_payouts.toLocaleString(),
                  accent: 'text-white',
                  testId: 'total-payouts',
                },
                {
                  label: 'Total FNDRY Paid',
                  value: `${fmtFndry(data.total_paid_out_fndry)} FNDRY`,
                  accent: 'text-yellow-400',
                  testId: 'total-fndry-paid',
                },
                {
                  label: 'Total SOL Paid',
                  value: `${fmtSol(data.total_paid_out_sol)} SOL`,
                  accent: 'text-white',
                  testId: 'total-sol-paid',
                },
                {
                  label: '30-Day Avg Burn',
                  value: `${fmtFndry(data.burn_rate.daily_avg_30d)} / day`,
                  accent:
                    data.burn_rate.daily_avg_30d > 10_000
                      ? 'text-red-400'
                      : 'text-[#14F195]',
                  testId: 'daily-avg-burn',
                },
              ].map(({ label, value, accent, testId }) => (
                <div
                  key={label}
                  className="rounded-xl border border-white/5 bg-white/[0.03] p-4"
                  data-testid={testId}
                >
                  <p className="text-xs text-gray-500 mb-1">{label}</p>
                  <p className={`text-xl font-bold tabular-nums truncate ${accent}`}>{value}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Treasury wallet ─────────────────────────────────────── */}
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <span>Treasury wallet:</span>
            <a
              href={`https://solscan.io/account/${data.treasury_wallet}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[#9945FF] hover:underline truncate"
              data-testid="treasury-wallet-link"
            >
              {data.treasury_wallet}
            </a>
          </div>

          {/* ── Daily outflow chart ──────────────────────────────────── */}
          <section aria-label="Daily outflow chart">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-widest mb-3">
              30-Day FNDRY Outflow
            </h3>
            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
              <OutflowSparkline points={data.daily_points} />
              {/* X-axis labels — show first, middle, last */}
              {data.daily_points.length > 2 && (
                <div className="flex justify-between mt-1 text-[10px] text-gray-600 tabular-nums">
                  <span>{fmtDate(data.daily_points[0].date)}</span>
                  <span>
                    {fmtDate(data.daily_points[Math.floor(data.daily_points.length / 2)].date)}
                  </span>
                  <span>{fmtDate(data.daily_points[data.daily_points.length - 1].date)}</span>
                </div>
              )}
            </div>
          </section>

          {/* ── Burn rate projections ───────────────────────────────── */}
          <section aria-label="Burn rate projections">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-widest mb-3">
              Burn Rate & Runway
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" data-testid="burn-rate-cards">
              {[
                {
                  label: '7-Day Avg',
                  rate: data.burn_rate.daily_avg_7d,
                  runway: data.burn_rate.runway_days_7d,
                },
                {
                  label: '30-Day Avg',
                  rate: data.burn_rate.daily_avg_30d,
                  runway: data.burn_rate.runway_days_30d,
                },
                {
                  label: '90-Day Avg',
                  rate: data.burn_rate.daily_avg_90d,
                  runway: null,
                },
              ].map(({ label, rate, runway }) => {
                const runwayColor =
                  runway === null
                    ? 'text-gray-500'
                    : runway < 30
                    ? 'text-red-400'
                    : runway < 90
                    ? 'text-yellow-400'
                    : 'text-[#14F195]';

                return (
                  <div
                    key={label}
                    className="rounded-xl border border-white/5 bg-white/[0.03] p-4 space-y-1"
                  >
                    <p className="text-xs text-gray-500">{label} burn</p>
                    <p className="text-lg font-bold tabular-nums text-white">
                      {fmtFndry(rate)}<span className="text-xs font-normal text-gray-500 ml-1">FNDRY/day</span>
                    </p>
                    {runway !== undefined && (
                      <p className={`text-xs ${runwayColor}`}>
                        {runway === null
                          ? 'Runway: ∞'
                          : `Runway: ~${runway.toLocaleString()} days`}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Spending by tier ────────────────────────────────────── */}
          <section aria-label="Spending by tier">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-widest mb-3">
              Spending by Bounty Tier
            </h3>
            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
              {data.spending_by_tier.every(t => t.total_fndry === 0) ? (
                <p className="text-sm text-gray-500 text-center py-4">No paid bounties yet</p>
              ) : (
                <TierBars tiers={data.spending_by_tier} />
              )}
            </div>
          </section>

          {/* ── Recent transactions ──────────────────────────────────── */}
          <section aria-label="Recent transactions">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-widest">
                Recent Transactions
              </h3>
              <span className="text-[10px] text-gray-600">
                {data.recent_transactions.length} shown
              </span>
            </div>
            <TxTable transactions={data.recent_transactions} />
          </section>
        </>
      )}
    </div>
  );
}
