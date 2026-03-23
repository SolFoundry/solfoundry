/**
 * Read-only treasury health: balance, flows, runway, tier spend, recent txs, CSV export.
 */
import { useMemo, useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TreasuryWalletConnect } from './TreasuryWalletConnect';
import { useTreasuryDashboard, parseTreasuryOwnerWallets } from '../../hooks/useAdminData';
import type { TreasuryDashboardResponse, TreasuryFlowBucket } from '../../types/admin';

/** Safe number formatting — API/proxy glitches must not crash the panel (null → runtime throw). */
export function fmtTreasuryNumber(n: number | null | undefined): string {
  const x = Number(n);
  if (!Number.isFinite(x)) return '—';
  if (x >= 1_000_000) return `${(x / 1_000_000).toFixed(2)}M`;
  if (x >= 1_000) return `${(x / 1_000).toFixed(1)}k`;
  return x.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function escapeCsvCell(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function treasuryDashboardToCsv(d: TreasuryDashboardResponse): string {
  const lines: string[] = [];
  lines.push('section,field,value');
  lines.push(`meta,treasury_wallet,${escapeCsvCell(d.treasury_wallet)}`);
  lines.push(`meta,fndry_balance,${d.fndry_balance}`);
  lines.push(`meta,generated_at,${escapeCsvCell(d.generated_at)}`);
  lines.push(`runway,avg_daily_outflow_fndry,${d.runway.avg_daily_outflow_fndry}`);
  lines.push(`runway,estimated_runway_days,${d.runway.estimated_runway_days ?? ''}`);
  lines.push(`runway,window_days,${d.runway.window_days}`);
  lines.push(`runway,total_outflow_window_fndry,${d.runway.total_outflow_window_fndry}`);
  Object.entries(d.tier_spending_fndry).forEach(([tier, amt]) => {
    lines.push(`tier_spending,tier_${tier},${amt}`);
  });
  lines.push('');
  lines.push('recent_transactions,kind,label,amount_fndry,amount_sol,occurred_at,tx_hash,explorer_url');
  for (const t of d.recent_transactions) {
    lines.push(
      [
        'recent_transactions',
        escapeCsvCell(t.kind),
        escapeCsvCell(t.label),
        String(t.amount_fndry),
        t.amount_sol != null ? String(t.amount_sol) : '',
        escapeCsvCell(t.occurred_at),
        escapeCsvCell(t.tx_hash ?? ''),
        escapeCsvCell(t.explorer_url ?? ''),
      ].join(','),
    );
  }
  return lines.join('\r\n');
}

type Granularity = 'daily' | 'weekly' | 'monthly';

function chartDataFor(
  series: TreasuryDashboardResponse['series'] | null | undefined,
  g: Granularity,
): TreasuryFlowBucket[] {
  if (!series) return [];
  const raw = series[g];
  if (!Array.isArray(raw)) return [];
  const normalized = raw.map(row => ({
    period: String(row?.period ?? ''),
    inflow_fndry: Number.isFinite(Number(row?.inflow_fndry)) ? Number(row.inflow_fndry) : 0,
    outflow_fndry: Number.isFinite(Number(row?.outflow_fndry)) ? Number(row.outflow_fndry) : 0,
  }));
  if (g === 'daily') return normalized.slice(-60);
  return normalized;
}

export function TreasuryPanel() {
  const { publicKey, connected } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;
  const ownerSet = useMemo(() => parseTreasuryOwnerWallets(), []);
  const needsOwner = ownerSet.size > 0;
  const ownerMismatch =
    needsOwner && connected && walletAddress != null && !ownerSet.has(walletAddress);

  const { data, isLoading, isFetching, error } = useTreasuryDashboard(walletAddress);
  const [granularity, setGranularity] = useState<Granularity>('daily');

  const chartData = useMemo(
    () => (data ? chartDataFor(data.series, granularity) : []),
    [data, granularity],
  );

  const downloadCsv = useCallback(() => {
    if (!data) return;
    const blob = new Blob([treasuryDashboardToCsv(data)], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `treasury-dashboard-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

  return (
    <div className="p-6 space-y-6" data-testid="treasury-panel">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Treasury</h2>
          <p className="text-xs text-gray-500 mt-1 max-w-xl">
            Read-only view of $FNDRY held at the treasury address, recorded inflows (buybacks) and
            outflows (confirmed FNDRY payouts), runway estimate, and paid bounty spend by tier. No
            on-chain actions are available here.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {data && (
            <button
              type="button"
              onClick={downloadCsv}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white hover:bg-white/10"
              data-testid="treasury-export-csv"
            >
              Export CSV
            </button>
          )}
          {isFetching && !isLoading && (
            <span className="text-[10px] text-gray-600" aria-live="polite">
              Refreshing…
            </span>
          )}
        </div>
      </div>

      {needsOwner && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-[#9945FF] uppercase tracking-wider">
              Owner wallet required
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Connect a wallet listed in <code className="text-gray-400">VITE_TREASURY_OWNER_WALLETS</code>{' '}
              so the API can verify <code className="text-gray-400">X-SF-Treasury-Wallet</code>.
            </p>
          </div>
          <TreasuryWalletConnect />
        </div>
      )}

      {ownerMismatch && (
        <div
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
          role="alert"
        >
          Connected wallet is not in the configured owner list. Switch to an authorized owner wallet
          to load treasury data.
        </div>
      )}

      {error && !ownerMismatch && (
        <p className="text-sm text-red-400" role="alert">
          {error instanceof Error ? error.message : 'Failed to load treasury dashboard'}
        </p>
      )}

      {data && !ownerMismatch && (!data.runway || !data.series) && (
        <p className="text-sm text-amber-400" role="status">
          Treasury response is missing expected fields (<code className="text-gray-400">runway</code> /{' '}
          <code className="text-gray-400">series</code>). Ensure the API implements{' '}
          <code className="text-gray-400">GET /api/admin/treasury/dashboard</code>.
        </p>
      )}

      {isLoading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      )}

      {data && !ownerMismatch && data.runway && data.series && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
              <p className="text-xs text-gray-500 mb-1">Treasury $FNDRY</p>
              <p className="text-xl font-bold tabular-nums text-[#14F195]">
                {fmtTreasuryNumber(data.fndry_balance)}
              </p>
              <p className="text-[10px] text-gray-600 mt-2 break-all">{data.treasury_wallet}</p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
              <p className="text-xs text-gray-500 mb-1">Est. runway</p>
              <p className="text-xl font-bold tabular-nums text-white">
                {data.runway.estimated_runway_days != null
                  ? `${fmtTreasuryNumber(data.runway.estimated_runway_days)} d`
                  : Number(data.runway.avg_daily_outflow_fndry) <= 0 &&
                      Number(data.fndry_balance) > 0
                    ? '∞'
                    : '—'}
              </p>
              <p className="text-[10px] text-gray-600 mt-2">
                Avg daily outflow {fmtTreasuryNumber(data.runway.avg_daily_outflow_fndry)} / last{' '}
                {data.runway.window_days ?? '—'}d
              </p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
              <p className="text-xs text-gray-500 mb-1">Outflow (window)</p>
              <p className="text-xl font-bold tabular-nums text-[#9945FF]">
                {fmtTreasuryNumber(data.runway.total_outflow_window_fndry)}
              </p>
              <p className="text-[10px] text-gray-600 mt-2">Confirmed FNDRY payouts</p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
              <p className="text-xs text-gray-500 mb-1">Last updated</p>
              <p className="text-sm font-medium text-gray-300 tabular-nums">
                {data.generated_at ? new Date(data.generated_at).toLocaleString() : '—'}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Bounty spend by tier (paid)</h3>
            <div className="flex flex-wrap gap-4">
              {Object.keys(data.tier_spending_fndry ?? {}).length === 0 && (
                <p className="text-xs text-gray-600">No paid bounties recorded.</p>
              )}
              {Object.entries(data.tier_spending_fndry ?? {}).map(([tier, amt]) => (
                <div key={tier} className="min-w-[100px]">
                  <p className="text-[10px] text-gray-600 uppercase">Tier {tier}</p>
                  <p className="text-lg font-semibold tabular-nums text-white">
                    {fmtTreasuryNumber(amt)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h3 className="text-sm font-medium text-gray-400">Inflow / outflow ($FNDRY)</h3>
              <div className="flex rounded-lg border border-white/10 p-0.5 w-fit">
                {(['daily', 'weekly', 'monthly'] as const).map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGranularity(g)}
                    className={
                      'px-3 py-1 text-[10px] rounded-md capitalize transition-colors ' +
                      (granularity === g
                        ? 'bg-[#9945FF]/25 text-[#9945FF]'
                        : 'text-gray-500 hover:text-gray-300')
                    }
                    data-testid={`treasury-chart-${g}`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            {chartData.length === 0 ? (
              <p className="text-xs text-gray-600 py-12 text-center">No flow data yet.</p>
            ) : (
              <div className="h-[280px] w-full min-h-[280px] min-w-0" data-testid="treasury-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff18" />
                    <XAxis
                      dataKey="period"
                      tick={{ fill: '#6b7280', fontSize: 10 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} width={48} />
                    <Tooltip
                      contentStyle={{
                        background: '#13131f',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: '#9ca3af' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="inflow_fndry" name="Inflow" fill="#14F195" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="outflow_fndry" name="Outflow" fill="#9945FF" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Recent transactions</h3>
            {(data.recent_transactions ?? []).length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-12">No payouts or buybacks yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/5">
                <table className="w-full text-xs" data-testid="treasury-tx-table">
                  <thead>
                    <tr className="border-b border-white/5 text-gray-500">
                      <th className="text-left px-4 py-3 font-medium">Type</th>
                      <th className="text-left px-4 py-3 font-medium">Detail</th>
                      <th className="text-right px-4 py-3 font-medium">$FNDRY</th>
                      <th className="text-left px-4 py-3 font-medium">Time</th>
                      <th className="text-left px-4 py-3 font-medium">Explorer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.recent_transactions ?? []).map(t => (
                      <tr key={`${t.kind}-${t.id}`} className="border-b border-white/5">
                        <td className="px-4 py-2 capitalize text-gray-400">{t.kind}</td>
                        <td className="px-4 py-2 text-gray-300 max-w-[200px] truncate">{t.label}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-white">
                          {fmtTreasuryNumber(t.amount_fndry)}
                        </td>
                        <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                          {new Date(t.occurred_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-2">
                          {t.explorer_url ? (
                            <a
                              href={t.explorer_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#14F195] hover:underline"
                            >
                              View
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
            )}
          </div>
        </>
      )}
    </div>
  );
}
