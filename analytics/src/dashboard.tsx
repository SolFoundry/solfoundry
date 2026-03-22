/**
 * Contributor Analytics Dashboard
 *
 * Full-page React dashboard showing:
 * - Platform summary cards (total contributors, rewards paid, etc.)
 * - Activity over time chart
 * - Top contributors leaderboard + bar chart
 * - Bounty completion rates by tier
 * - Daily reward trend
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  fetchContributors,
  fetchDailyActivity,
  fetchCompletionStats,
  fetchPlatformMetrics,
  type ContributorStats,
  type DailyActivity,
  type BountyCompletionStat,
  type PlatformMetrics,
} from './api.js';
import {
  ActivityChart,
  TopContributorsChart,
  CompletionRateChart,
  RewardTrendChart,
} from './charts.js';

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtFND(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

function fmtPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, sub, color = '#6366f1' }) => (
  <div style={{
    background: '#1e293b',
    borderRadius: 12,
    padding: '20px 24px',
    flex: '1 1 180px',
    minWidth: 150,
    borderLeft: `3px solid ${color}`,
  }}>
    <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 28, fontWeight: 700, color: '#f1f5f9' }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{sub}</div>}
  </div>
);

interface ContributorRowProps {
  c: ContributorStats;
  rank: number;
}

const TIER_COLORS: Record<string, string> = { T1: '#94a3b8', T2: '#6366f1', T3: '#f59e0b' };

const ContributorRow: React.FC<ContributorRowProps> = ({ c, rank }) => (
  <tr style={{ borderBottom: '1px solid #1e293b' }}>
    <td style={{ padding: '10px 12px', color: '#64748b', width: 40 }}>#{rank}</td>
    <td style={{ padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {c.avatarUrl && (
          <img src={c.avatarUrl} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
        )}
        <div>
          <div style={{ fontWeight: 600, color: '#e2e8f0' }}>@{c.githubHandle}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>{c.skills.slice(0, 3).join(', ')}</div>
        </div>
      </div>
    </td>
    <td style={{ padding: '10px 12px' }}>
      <span style={{
        background: `${TIER_COLORS[c.tier]}22`,
        color: TIER_COLORS[c.tier],
        borderRadius: 4,
        padding: '2px 8px',
        fontSize: 12,
        fontWeight: 600,
      }}>{c.tier}</span>
    </td>
    <td style={{ padding: '10px 12px', color: '#e2e8f0', textAlign: 'right' }}>{c.reputation}</td>
    <td style={{ padding: '10px 12px', color: '#22c55e', textAlign: 'right' }}>{c.bountiesCompleted}</td>
    <td style={{ padding: '10px 12px', color: '#f59e0b', textAlign: 'right', fontWeight: 600 }}>
      {fmtFND(c.totalEarned)} <span style={{ fontSize: 11, color: '#64748b' }}>$FNDRY</span>
    </td>
    <td style={{ padding: '10px 12px', color: '#94a3b8', textAlign: 'right' }}>
      {fmtPct(c.successRate)}
    </td>
  </tr>
);

// ── Main Dashboard ─────────────────────────────────────────────────────────────

interface DashboardState {
  metrics:      PlatformMetrics | null;
  contributors: ContributorStats[];
  activity:     DailyActivity[];
  completion:   BountyCompletionStat[];
  loading:      boolean;
  error:        string | null;
  search:       string;
  tierFilter:   '' | 'T1' | 'T2' | 'T3';
}

export const ContributorAnalyticsDashboard: React.FC = () => {
  const [state, setState] = useState<DashboardState>({
    metrics:      null,
    contributors: [],
    activity:     [],
    completion:   [],
    loading:      true,
    error:        null,
    search:       '',
    tierFilter:   '',
  });

  const load = useCallback(async (search = '', tier = '') => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [metrics, contribRes, activity, completion] = await Promise.all([
        fetchPlatformMetrics(),
        fetchContributors({
          pageSize: 50,
          search: search || undefined,
          tier:   tier   || undefined,
          sortBy: 'reputation',
        }),
        fetchDailyActivity(30),
        fetchCompletionStats(),
      ]);
      setState((s) => ({
        ...s,
        metrics,
        contributors: contribRes.data,
        activity,
        completion,
        loading: false,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setState((s) => ({ ...s, search: v }));
    void load(v, state.tierFilter);
  };

  const handleTierFilter = (tier: '' | 'T1' | 'T2' | 'T3') => {
    setState((s) => ({ ...s, tierFilter: tier }));
    void load(state.search, tier);
  };

  const { metrics, contributors, activity, completion, loading, error } = state;

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>
        <div style={{ fontSize: 48 }}>⚠️</div>
        <div style={{ marginTop: 16, fontSize: 16 }}>Failed to load analytics: {error}</div>
        <button onClick={() => void load()} style={{ marginTop: 16, padding: '8px 24px', cursor: 'pointer' }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: '#0f172a', minHeight: '100vh', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#1e293b', borderBottom: '1px solid #334155', padding: '20px 32px' }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>
          📊 Contributor Analytics
        </h1>
        <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 14 }}>
          Real-time insights into SolFoundry contributor activity and bounty performance
        </p>
      </div>

      <div style={{ padding: '32px', maxWidth: 1400, margin: '0 auto' }}>
        {/* Summary Cards */}
        {metrics && (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
            <MetricCard
              label="Total Contributors"
              value={metrics.totalContributors.toLocaleString()}
              sub={`${metrics.activeContributors} active last 30d`}
              color="#6366f1"
            />
            <MetricCard
              label="Bounties Completed"
              value={metrics.totalBountiesCompleted.toLocaleString()}
              color="#22c55e"
            />
            <MetricCard
              label="Total Rewards Paid"
              value={`${fmtFND(metrics.totalRewardPaid)} $FNDRY`}
              color="#f59e0b"
            />
            <MetricCard
              label="Avg Completion Time"
              value={`${metrics.averageCompletionDays.toFixed(1)} days`}
              color="#06b6d4"
            />
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
            Loading analytics…
          </div>
        )}

        {!loading && (
          <>
            {/* Activity chart */}
            <div style={{ marginBottom: 24 }}>
              <ActivityChart data={activity} />
            </div>

            {/* Charts row */}
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 24 }}>
              <div style={{ flex: '1 1 400px' }}>
                <TopContributorsChart contributors={contributors} limit={10} />
              </div>
              <div style={{ flex: '1 1 400px' }}>
                <CompletionRateChart stats={completion} />
              </div>
            </div>

            {/* Reward trend */}
            <div style={{ marginBottom: 32 }}>
              <RewardTrendChart data={activity} />
            </div>

            {/* Contributor table */}
            <div style={{ background: '#1e293b', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #334155', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, flex: 1, fontSize: 16 }}>All Contributors</h3>
                <input
                  placeholder="Search by handle…"
                  value={state.search}
                  onChange={handleSearch}
                  style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', width: 200 }}
                />
                {(['', 'T1', 'T2', 'T3'] as const).map((t) => (
                  <button
                    key={t || 'all'}
                    onClick={() => handleTierFilter(t)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 6,
                      border: '1px solid #334155',
                      background: state.tierFilter === t ? '#6366f1' : '#0f172a',
                      color: '#e2e8f0',
                      cursor: 'pointer',
                      fontWeight: state.tierFilter === t ? 700 : 400,
                    }}
                  >
                    {t || 'All'}
                  </button>
                ))}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: '#0f172a' }}>
                      {['#', 'Contributor', 'Tier', 'Rep', 'Done', 'Earned', 'Success'].map((h) => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: h === '#' || h === 'Contributor' ? 'left' : 'right', color: '#94a3b8', fontWeight: 600, fontSize: 12 }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {contributors.map((c, i) => (
                      <ContributorRow key={c.githubHandle} c={c} rank={i + 1} />
                    ))}
                    {contributors.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                          No contributors found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ContributorAnalyticsDashboard;
