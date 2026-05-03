import React, { useMemo } from 'react';
import { Download, Users, Trophy, Wallet, Activity } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageLayout } from '../components/layout/PageLayout';
import { useBounties } from '../hooks/useBounties';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { analyticsCsv, buildAnalyticsMetrics } from '../api/analytics';

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="rounded-2xl border border-border bg-forge-900/80 p-5 shadow-lg shadow-black/20">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">{label}</p>
        <Icon className="h-5 w-5 text-emerald" />
      </div>
      <p className="mt-3 font-display text-2xl font-semibold text-text-primary">{value}</p>
    </div>
  );
}

function exportCsv(csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'solfoundry-bounty-analytics.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export function AnalyticsPage() {
  const bountiesQuery = useBounties({ limit: 100 });
  const leaderboardQuery = useLeaderboard('all');

  const bounties = bountiesQuery.data?.items ?? [];
  const leaderboard = leaderboardQuery.data ?? [];
  const metrics = useMemo(() => buildAnalyticsMetrics(bounties, leaderboard), [bounties, leaderboard]);

  const loading = bountiesQuery.isLoading || leaderboardQuery.isLoading;
  const error = bountiesQuery.error || leaderboardQuery.error;

  return (
    <PageLayout>
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-sm uppercase tracking-[0.3em] text-emerald">Bounty intelligence</p>
            <h1 className="mt-3 font-display text-4xl font-bold text-text-primary">Analytics Dashboard</h1>
            <p className="mt-3 max-w-2xl text-text-secondary">
              Track bounty volume, payouts, completion health, and contributor growth from SolFoundry data.
            </p>
          </div>
          <button
            type="button"
            onClick={() => exportCsv(analyticsCsv(metrics))}
            disabled={loading || bounties.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-border bg-emerald-bg px-4 py-3 text-sm font-semibold text-emerald transition hover:border-emerald disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-status-error/30 bg-status-error/10 p-4 text-sm text-status-error">
            Analytics data is unavailable right now. Please retry after the API responds.
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-border bg-forge-900 p-8 text-center text-text-secondary">Loading analytics…</div>
        ) : bounties.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-forge-900 p-8 text-center">
            <p className="text-lg font-semibold text-text-primary">No bounty data yet</p>
            <p className="mt-2 text-sm text-text-secondary">Create or sync bounties to populate analytics.</p>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Open bounties" value={String(metrics.openBounties)} icon={Activity} />
              <StatCard label="Completed" value={String(metrics.completedBounties)} icon={Trophy} />
              <StatCard label="Reward volume" value={metrics.totalReward.toLocaleString()} icon={Wallet} />
              <StatCard label="Contributors" value={String(metrics.activeContributors)} icon={Users} />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-forge-900/80 p-5">
                <h2 className="mb-4 font-display text-lg font-semibold text-text-primary">Bounty volume over time</h2>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics.bountyVolume}>
                      <CartesianGrid stroke="#1E1E2E" vertical={false} />
                      <XAxis dataKey="label" stroke="#A0A0B8" />
                      <YAxis stroke="#A0A0B8" />
                      <Tooltip contentStyle={{ background: '#0A0A0F', border: '1px solid #1E1E2E' }} />
                      <Bar dataKey="bounties" fill="#00E676" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-forge-900/80 p-5">
                <h2 className="mb-4 font-display text-lg font-semibold text-text-primary">Payout distribution by tier</h2>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics.payoutDistribution}>
                      <CartesianGrid stroke="#1E1E2E" vertical={false} />
                      <XAxis dataKey="label" stroke="#A0A0B8" />
                      <YAxis stroke="#A0A0B8" />
                      <Tooltip contentStyle={{ background: '#0A0A0F', border: '1px solid #1E1E2E' }} />
                      <Bar dataKey="reward" fill="#7C3AED" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </PageLayout>
  );
}
