import React from 'react';
import { motion } from 'framer-motion';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, Download, Users } from 'lucide-react';
import { PageLayout } from '../components/layout/PageLayout';
import { useBountyVolume, useContributorAnalytics, usePayoutSeries } from '../hooks/useBountyAnalytics';
import { ANALYTICS_EXPORT } from '../api/analytics';
import { fadeIn } from '../lib/animations';

function shortDate(iso: string) {
  try {
    const d = new Date(iso + 'T12:00:00Z');
    return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
  } catch {
    return iso;
  }
}

export function BountyAnalyticsPage() {
  const vol = useBountyVolume();
  const pay = usePayoutSeries();
  const contrib = useContributorAnalytics();

  const loading = vol.isLoading || pay.isLoading || contrib.isLoading;
  const error = vol.isError || pay.isError || contrib.isError;

  return (
    <PageLayout>
      <motion.div
        data-testid="bounty-analytics-page"
        variants={fadeIn}
        initial="initial"
        animate="animate"
        className="max-w-6xl mx-auto px-4 py-12"
      >
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-10">
          <div>
            <div className="flex items-center gap-2 text-emerald mb-2">
              <BarChart3 className="w-6 h-6" />
              <span className="text-sm font-medium uppercase tracking-wide">Insights</span>
            </div>
            <h1 className="font-display text-4xl font-bold text-text-primary mb-2">Bounty analytics</h1>
            <p className="text-text-secondary max-w-xl">
              Time-series volume and payouts, contributor growth and retention, with exportable reports (seed data
              until connected to the primary API).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={ANALYTICS_EXPORT.csv}
              download
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-forge-800 border border-border hover:border-emerald-border text-text-primary text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </a>
            <a
              href={ANALYTICS_EXPORT.pdf}
              download
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-bg border border-emerald-border text-emerald text-sm font-medium hover:bg-emerald-bg/80 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export PDF
            </a>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 rounded-full border-2 border-emerald border-t-transparent animate-spin" />
          </div>
        )}

        {error && !loading && (
          <div className="rounded-xl border border-border bg-forge-900/80 p-8 text-center">
            <p className="text-text-muted">Could not load analytics. Is the API running on port 8000?</p>
          </div>
        )}

        {!loading && !error && vol.data && pay.data && contrib.data && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
              <div className="rounded-xl border border-border bg-forge-900/50 p-5">
                <p className="text-xs text-text-muted uppercase tracking-wide mb-1">New contributors (30d)</p>
                <p className="font-display text-3xl font-bold text-text-primary">
                  {contrib.data.new_contributors_last_30d}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-forge-900/50 p-5">
                <p className="text-xs text-text-muted uppercase tracking-wide mb-1">Active contributors (30d)</p>
                <p className="font-display text-3xl font-bold text-text-primary">
                  {contrib.data.active_contributors_last_30d}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-forge-900/50 p-5">
                <p className="text-xs text-text-muted uppercase tracking-wide mb-1">Retention rate</p>
                <p className="font-display text-3xl font-bold text-emerald">
                  {(contrib.data.retention_rate * 100).toFixed(0)}%
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
              <div className="rounded-xl border border-border bg-forge-900/40 p-4">
                <h2 className="text-lg font-semibold text-text-primary mb-4">Bounty volume</h2>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={vol.data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a3344" />
                      <XAxis dataKey="date" tickFormatter={shortDate} stroke="#8892a0" fontSize={11} />
                      <YAxis stroke="#8892a0" fontSize={11} />
                      <Tooltip
                        contentStyle={{ background: '#121826', border: '1px solid #2a3344' }}
                        labelFormatter={(v) => String(v)}
                      />
                      <Line type="monotone" dataKey="count" stroke="#00e676" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-forge-900/40 p-4">
                <h2 className="text-lg font-semibold text-text-primary mb-4">Payouts (USD)</h2>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={pay.data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a3344" />
                      <XAxis dataKey="date" tickFormatter={shortDate} stroke="#8892a0" fontSize={11} />
                      <YAxis stroke="#8892a0" fontSize={11} tickFormatter={(v) => `$${v}`} />
                      <Tooltip
                        contentStyle={{ background: '#121826', border: '1px solid #2a3344' }}
                        formatter={(value) => {
                          const n = typeof value === 'number' ? value : Number(value);
                          return [`$${Number.isFinite(n) ? n.toLocaleString() : value}`, 'Amount'];
                        }}
                      />
                      <Line type="monotone" dataKey="amountUsd" stroke="#6366f1" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-forge-900/40 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-emerald" />
                <h2 className="text-lg font-semibold text-text-primary">Weekly new contributors</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-text-muted border-b border-border">
                      <th className="pb-2 pr-4">Week starting</th>
                      <th className="pb-2">New contributors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contrib.data.weekly_growth.map((w) => (
                      <tr key={w.week_start} className="border-b border-border/50 text-text-secondary">
                        <td className="py-2 pr-4 font-mono text-xs">{w.week_start}</td>
                        <td className="py-2">{w.new_contributors}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </motion.div>
    </PageLayout>
  );
}
