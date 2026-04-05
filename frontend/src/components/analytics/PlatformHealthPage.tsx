import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { MetricCard } from './MetricCard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GrowthPoint {
  date: string;
  bounties_created: number;
  bounties_completed: number;
  new_contributors: number;
  fndry_paid: number;
}

interface CategoryStat {
  category: string;
  total_bounties: number;
  completed: number;
  completion_rate: number;
  average_review_score: number;
  total_reward_paid: number;
}

interface PlatformHealth {
  total_contributors: number;
  active_contributors: number;
  total_bounties: number;
  open_bounties: number;
  in_progress_bounties: number;
  completed_bounties: number;
  total_fndry_paid: number;
  total_prs_reviewed: number;
  average_review_score: number;
  bounties_by_status: Record<string, number>;
  growth_trend: GrowthPoint[];
  top_categories: CategoryStat[];
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

function exportCSV(data: PlatformHealth) {
  const rows = data.growth_trend.map((g) =>
    `${g.date},${g.bounties_created},${g.bounties_completed},${g.new_contributors},${g.fndry_paid}`,
  );
  const csv = ['Date,Created,Completed,New Contributors,FNDRY Paid', ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'platform-health.csv';
  a.click();
  URL.revokeObjectURL(url);
}

async function fetchPlatformHealth(timeRange: string): Promise<PlatformHealth> {
  const res = await fetch(`/api/analytics/platform?time_range=${timeRange}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to load platform health');
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PlatformHealthPage() {
  const [timeRange, setTimeRange] = useState('7d');

  const { data, isLoading, error } = useQuery<PlatformHealth, Error>({
    queryKey: ['analytics-platform', timeRange],
    queryFn: () => fetchPlatformHealth(timeRange),
    staleTime: 30_000,
  });

  return (
    <div data-testid="platform-health-page" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Platform Health</h1>
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <MetricCard
              testId="metric-contributors"
              label="Total Contributors"
              value={data.total_contributors}
              subtitle={`${data.active_contributors} active`}
              icon="👥"
            />
            <MetricCard
              testId="metric-bounties"
              label="Total Bounties"
              value={data.total_bounties}
              subtitle={`${data.open_bounties} open`}
              icon="📋"
            />
            <MetricCard
              testId="metric-fndry-paid"
              label="$FNDRY Paid"
              value={data.total_fndry_paid}
              icon="💰"
            />
            <MetricCard
              label="Avg Review Score"
              value={data.average_review_score.toFixed(1)}
              icon="⭐"
            />
          </div>

          {/* Growth trend chart */}
          {data.growth_trend.length > 0 && (
            <div className="bg-[#0d0d1a] border border-white/10 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-white/70 mb-4">Growth Trend</h2>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.growth_trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                  <Line type="monotone" dataKey="bounties_created" stroke="#9945FF" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="bounties_completed" stroke="#14F195" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="new_contributors" stroke="#60a5fa" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Bounties by Status */}
          <div className="bg-[#0d0d1a] border border-white/10 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white/70 mb-4">Bounties by Status</h2>
            <div className="flex flex-wrap gap-4">
              {Object.entries(data.bounties_by_status).map(([status, count]) => (
                <div key={status} className="text-center">
                  <p className="text-2xl font-bold text-white">{count}</p>
                  <p className="text-xs text-white/40 mt-0.5 capitalize">{status.replace('_', ' ')}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Top Categories */}
          {data.top_categories.length > 0 && (
            <div className="bg-[#0d0d1a] border border-white/10 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-white/70 mb-4">Top Categories</h2>
              <div className="space-y-3">
                {data.top_categories.map((cat) => (
                  <div key={cat.category} className="flex items-center justify-between">
                    <span className="text-sm text-white capitalize">{cat.category}</span>
                    <div className="flex items-center gap-4 text-xs text-white/50">
                      <span>{cat.total_bounties} bounties</span>
                      <span className="text-[#14F195]">{cat.completion_rate.toFixed(0)}% complete</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
