/**
 * Treasury health dashboard — owner-wallet gated, read-only, auto-refreshing.
 */
import { useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { useTreasuryDashboard, parseTreasuryOwnerWallets } from '../../hooks/useAdminData';
import { solscanAddressUrl } from '../../config/constants';
import { useNetwork } from '../wallet/WalletProvider';
import type { TreasuryTxItem } from '../../types/admin';

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function shortPeriodLabel(iso: string, mode: 'daily' | 'weekly' | 'monthly') {
  const d = new Date(`${iso}T12:00:00Z`);
  if (mode === 'daily') {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  if (mode === 'weekly') {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function transactionsToCsv(transactions: TreasuryTxItem[]): string {
  const cols = [
    'occurred_at',
    'kind',
    'direction',
    'token',
    'amount_fndry',
    'amount_sol',
    'tx_hash',
    'explorer_url',
    'bounty_title',
    'counterparty',
  ] as const;
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [cols.join(',')];
  for (const r of transactions) {
    lines.push(cols.map(c => esc(r[c])).join(','));
  }
  return lines.join('\n');
}

export function TreasuryDashboardPanel() {
  const { publicKey, connect, connecting } = useWallet();
  const { network } = useNetwork();
  const owners = parseTreasuryOwnerWallets();
  const { data, isLoading, isFetching, error, refetch } = useTreasuryDashboard(publicKey);

  const [granularity, setGranularity] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.chart[granularity].map(row => ({
      ...row,
      label: shortPeriodLabel(row.period_start, granularity),
    }));
  }, [data, granularity]);

  const walletAddr = publicKey?.toBase58() ?? null;
  const ownerMismatch =
    owners.length > 0 && walletAddr !== null && !owners.includes(walletAddr.toLowerCase());

  const pdaUrl = data ? solscanAddressUrl(data.treasury_pda_address, network) : null;

  const handleExport = () => {
    if (!data) return;
    const txCsv = transactionsToCsv(data.recent_transactions);
    const tierHeader = '\n\n# tier_spending\n';
    const tierLines = [
      'tier,total_fndry,bounty_count',
      ...data.tier_spending.map(
        t => `${t.tier},${t.total_fndry},${t.bounty_count}`,
      ),
    ].join('\n');
    downloadCsv(
      `solfoundry-treasury-${new Date().toISOString().slice(0, 10)}.csv`,
      txCsv + tierHeader + tierLines,
    );
  };

  if (owners.length > 0 && !publicKey) {
    return (
      <div className="p-6 max-w-lg space-y-4" data-testid="treasury-wallet-gate">
        <h2 className="text-lg font-semibold">Treasury</h2>
        <p className="text-sm text-gray-400">
          Connect the Solana wallet listed in <code className="text-gray-300">VITE_TREASURY_OWNER_WALLETS</code>{' '}
          to open the treasury dashboard.
        </p>
        <button
          type="button"
          onClick={() => connect().catch(console.error)}
          disabled={connecting}
          className="rounded-lg bg-gradient-to-r from-[#9945FF] to-[#14F195] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {connecting ? 'Connecting…' : 'Connect wallet'}
        </button>
      </div>
    );
  }

  if (ownerMismatch) {
    return (
      <div className="p-6 max-w-lg space-y-3" data-testid="treasury-access-denied">
        <h2 className="text-lg font-semibold text-red-400">Access denied</h2>
        <p className="text-sm text-gray-400">
          The connected wallet is not in the configured owner allowlist. Disconnect and connect an authorized
          owner wallet.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8" data-testid="treasury-dashboard">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Treasury health</h2>
          <p className="text-xs text-gray-500 mt-1">
            Read-only view — no transfers or signing from this page. Refreshes every 30s.
            {isFetching && !isLoading ? <span className="ml-2 text-[#14F195]">Updating…</span> : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
          >
            Refresh now
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={!data}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10 disabled:opacity-40"
            data-testid="treasury-export-csv"
          >
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {(error as Error).message}
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
              <p className="text-xs text-gray-500 mb-1">$FNDRY in treasury (PDA / vault)</p>
              <p
                className="text-2xl font-bold tabular-nums text-[#14F195]"
                data-testid="treasury-fndry-balance"
              >
                {fmt(data.fndry_balance)}
              </p>
              {pdaUrl && (
                <a
                  href={pdaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-[#9945FF] hover:underline mt-2 inline-block break-all"
                >
                  {data.treasury_pda_address}
                </a>
              )}
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
              <p className="text-xs text-gray-500 mb-1">Avg daily outflow ({data.projections.window_days}d)</p>
              <p className="text-2xl font-bold tabular-nums text-white">
                {fmt(data.projections.avg_daily_outflow_fndry)} <span className="text-sm text-gray-500">FNDRY</span>
              </p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
              <p className="text-xs text-gray-500 mb-1">Est. runway</p>
              <p className="text-2xl font-bold tabular-nums text-white">
                {data.projections.runway_days != null
                  ? `${fmt(data.projections.runway_days)} days`
                  : '—'}
              </p>
              {data.projections.note && (
                <p className="text-[10px] text-gray-500 mt-2">{data.projections.note}</p>
              )}
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
              <p className="text-xs text-gray-500 mb-1">Last synced</p>
              <p className="text-sm text-gray-300 mt-2">
                {new Date(data.last_updated).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="text-sm font-medium text-gray-400">Inflow / outflow ($FNDRY)</h3>
              <div className="flex rounded-lg border border-white/10 p-0.5 text-[10px]">
                {(['daily', 'weekly', 'monthly'] as const).map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGranularity(g)}
                    className={
                      'px-3 py-1 rounded-md capitalize transition-colors ' +
                      (granularity === g ? 'bg-[#9945FF]/30 text-white' : 'text-gray-500 hover:text-gray-300')
                    }
                    data-testid={`treasury-granularity-${g}`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-72 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} width={48} />
                  <Tooltip
                    contentStyle={{ background: '#1a1a2e', border: '1px solid #ffffff20', borderRadius: 8 }}
                    labelStyle={{ color: '#e5e7eb' }}
                  />
                  <Legend />
                  <Bar dataKey="inflow" name="Inflow" fill="#14F195" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="outflow" name="Outflow" fill="#9945FF" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Bounty spending by tier (paid)</h3>
            <div className="overflow-x-auto rounded-xl border border-white/5">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5 text-gray-500">
                    <th className="text-left px-4 py-3 font-medium">Tier</th>
                    <th className="text-right px-4 py-3 font-medium">Total $FNDRY</th>
                    <th className="text-right px-4 py-3 font-medium">Bounties</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tier_spending.map(row => (
                    <tr key={row.tier} className="border-b border-white/5">
                      <td className="px-4 py-3">T{row.tier}</td>
                      <td className="text-right px-4 py-3 tabular-nums text-[#14F195]">{fmt(row.total_fndry)}</td>
                      <td className="text-right px-4 py-3 tabular-nums">{row.bounty_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Recent on-chain activity</h3>
            {data.recent_transactions.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No confirmed payouts or buybacks yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/5 max-h-[420px] overflow-y-auto">
                <table className="w-full text-xs" data-testid="treasury-tx-table">
                  <thead className="sticky top-0 bg-[#0a0a14] z-10">
                    <tr className="border-b border-white/5 text-gray-500">
                      <th className="text-left px-4 py-3 font-medium">Time</th>
                      <th className="text-left px-4 py-3 font-medium">Type</th>
                      <th className="text-right px-4 py-3 font-medium">Amount</th>
                      <th className="text-left px-4 py-3 font-medium">Detail</th>
                      <th className="text-left px-4 py-3 font-medium">Explorer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_transactions.map(tx => (
                      <tr key={`${tx.kind}-${tx.id}`} className="border-b border-white/5">
                        <td className="px-4 py-2 text-gray-400 whitespace-nowrap">
                          {new Date(tx.occurred_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-2 capitalize">
                          <span
                            className={
                              tx.direction === 'inflow' ? 'text-[#14F195]' : 'text-[#9945FF]'
                            }
                          >
                            {tx.kind}
                          </span>
                        </td>
                        <td className="text-right px-4 py-2 tabular-nums">
                          {tx.amount_fndry != null ? `${fmt(tx.amount_fndry)} FNDRY` : ''}
                          {tx.amount_sol != null ? `${fmt(tx.amount_sol)} SOL` : ''}
                        </td>
                        <td className="px-4 py-2 text-gray-400 max-w-[200px] truncate">
                          {tx.bounty_title ?? tx.counterparty ?? '—'}
                        </td>
                        <td className="px-4 py-2">
                          {tx.explorer_url ? (
                            <a
                              href={tx.explorer_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#9945FF] hover:underline"
                            >
                              View
                            </a>
                          ) : (
                            '—'
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
