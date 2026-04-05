import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { MetricCard } from './MetricCard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TierStat {
  tier: number;
  total_bounties: number;
  completed: number;
  in_progress: number;
  open: number;
  completion_rate: number;
  average_review_score: number;
  average_time_to_complete_hours: number;
  total_reward_paid: number;
}

interface CategoryStat {
  category: string;
  total_bounties: number;
  completed: number;
  completion_rate: number;
  average_review_score: number;
  total_reward_paid: number;
}

interface BountyAnalytics {
  by_tier: TierStat[];
  by_category: CategoryStat[];
  overall_completion_rate: number;
  overall_average_review_score: number;
  total_bounties: number;
  total_completed: number;
  total_reward_paid: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TIME_RANGES = [
  { label: '7 days',  value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
  { label: 'All time', value: 'all' },
];

function exportCSV(data: BountyAnalytics) {
  const tierRows = data.by_tier.map((t) =>
    `Tier ${t.tier},${t.total_bounties},${t.completed},${t.completion_rate.toFixed(1)}%`,
  );
  const csv = ['Tier,Total,Completed,Rate', ...tierRows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bounty-analytics.csv';
  a.click();
  URL.revokeObjectURL(url);
}

async function fetchBountyAnalytics(timeRange: string): Promise<BountyAnalytics> {
  const res = await fetch(`/api/analytics/bounties?time_range=${timeRange}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to load bounty analytics');
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BountyAnalyticsPage() {
  const [timeRange, setTimeRange] = useState('all');

  const { data, isLoading, error } = useQuery<BountyAnalytics, Error>({
    queryKey: ['analytics-bounties', timeRange],
    queryFn: () => fetchBountyAnalytics(timeRange),
    staleTime: 30_000,
  });

  return (
    <div data-testid="bounty-analytics-page" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Bounty Analytics</h1>
        <div className="flex items-center gap-3">
          {data && (
            <div className="flex gap-2">
              <button
                onClick={() => exportCSV(data)}
                className="px-3 py-1.5 text-xs bg-white/5 border border-white/10 text-white/60 rounded-lg hover:bg-white/10"
              >
                Export CSV
              </button>
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 text-xs bg-white/5 border border-white/10 text-white/60 rounded-lg hover:bg-white/10"
              >
                Export PDF
              </button>
            </div>
          )}
          {/* Time range */}
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            {TIME_RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setTimeRange(r.value)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  timeRange === r.value
                    ? 'bg-[#14F195] text-black'
                    : 'bg-white/5 text-white/50 hover:bg-white/10'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div role="alert" className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
          {error.message}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-white/5 rounded-xl h-24" />
          ))}
        </div>
      )}

      {/* Content */}
      {!isLoading && !error && data && (
        <>
          {/* Metric cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              testId="metric-total-bounties"
              label="Total Bounties"
              value={data.total_bounties}
              icon="📋"
            />
            <MetricCard
              testId="metric-completed"
              label="Completed"
              value={data.total_completed}
              icon="✅"
            />
            <MetricCard
              testId="metric-completion-rate"
              label="Completion Rate"
              value={`${data.overall_completion_rate.toFixed(1)}%`}
              icon="📈"
            />
            <MetricCard
              label="Avg Review Score"
              value={data.overall_average_review_score.toFixed(1)}
              icon="⭐"
            />
          </div>

          {/* Tier distribution chart */}
          <div className="bg-[#0d0d1a] border border-white/10 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white/70 mb-4">Completion by Tier</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.by_tier.map((t) => ({ name: `Tier ${t.tier}`, completed: t.completed, open: t.open }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }} />
                <Tooltip contentStyle={{ background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                <Bar dataKey="completed" fill="#14F195" radius={[4, 4, 0, 0]} />
                <Bar dataKey="open" fill="rgba(255,255,255,0.1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tier statistics table */}
          <div className="bg-[#0d0d1a] border border-white/10 rounded-xl p-5 overflow-x-auto">
            <table aria-label="tier statistics" className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/40 text-xs">
                  <th className="text-left pb-3 pr-4">Tier</th>
                  <th className="text-right pb-3 pr-4">Total</th>
                  <th className="text-right pb-3 pr-4">Completed</th>
                  <th className="text-right pb-3 pr-4">Rate</th>
                  <th className="text-right pb-3 pr-4">Avg Score</th>
                  <th className="text-right pb-3">Reward Paid</th>
                </tr>
              </thead>
              <tbody>
                {data.by_tier.map((t) => (
                  <tr key={t.tier} className="border-b border-white/5">
                    <td className="py-3 pr-4 text-white font-medium">Tier {t.tier}</td>
                    <td className="py-3 pr-4 text-right text-white/70">{t.total_bounties}</td>
                    <td className="py-3 pr-4 text-right text-[#14F195]">{t.completed}</td>
                    <td className="py-3 pr-4 text-right text-white/70">{t.completion_rate.toFixed(1)}%</td>
                    <td className="py-3 pr-4 text-right text-white/70">{t.average_review_score.toFixed(1)}</td>
                    <td className="py-3 text-right text-white/70">{(t.total_reward_paid / 1e6).toFixed(1)}M</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Category statistics table */}
          <div className="bg-[#0d0d1a] border border-white/10 rounded-xl p-5 overflow-x-auto">
            <table aria-label="category statistics" className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/40 text-xs">
                  <th className="text-left pb-3 pr-4">Category</th>
                  <th className="text-right pb-3 pr-4">Total</th>
                  <th className="text-right pb-3 pr-4">Completed</th>
                  <th className="text-right pb-3 pr-4">Rate</th>
                  <th className="text-right pb-3">Avg Score</th>
                </tr>
              </thead>
              <tbody>
                {data.by_category.map((c) => (
                  <tr key={c.category} className="border-b border-white/5">
                    <td className="py-3 pr-4 text-white font-medium capitalize">{c.category}</td>
                    <td className="py-3 pr-4 text-right text-white/70">{c.total_bounties}</td>
                    <td className="py-3 pr-4 text-right text-[#14F195]">{c.completed}</td>
                    <td className="py-3 pr-4 text-right text-white/70">{c.completion_rate.toFixed(1)}%</td>
                    <td className="py-3 text-right text-white/70">{c.average_review_score.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
