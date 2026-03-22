/**
 * Analytics Charts — Recharts-based visualisations
 */

import React from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { DailyActivity, BountyCompletionStat, ContributorStats } from './api.js';

// ── Palette ────────────────────────────────────────────────────────────────────
const COLORS = {
  primary: '#6366f1',
  success: '#22c55e',
  warning: '#f59e0b',
  danger:  '#ef4444',
  muted:   '#94a3b8',
  T1: '#94a3b8',
  T2: '#6366f1',
  T3: '#f59e0b',
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtFND(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000)     return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Chart 1 — Contributions over time (area + line combo)
// ─────────────────────────────────────────────────────────────────────────────
interface ActivityChartProps {
  data: DailyActivity[];
}

export const ActivityChart: React.FC<ActivityChartProps> = ({ data }) => {
  const formatted = data.map((d) => ({
    ...d,
    date: fmtDate(d.date),
  }));

  return (
    <div className="chart-card">
      <h3 className="chart-title">Platform Activity (Last 30 Days)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={formatted} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradSubmissions" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={COLORS.primary} stopOpacity={0.3} />
              <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}   />
            </linearGradient>
            <linearGradient id="gradCompletions" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={COLORS.success} stopOpacity={0.3} />
              <stop offset="95%" stopColor={COLORS.success} stopOpacity={0}   />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#475569" />
          <YAxis tick={{ fontSize: 12 }} stroke="#475569" />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
            labelStyle={{ color: '#e2e8f0' }}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="submissionsCount"
            name="Submissions"
            stroke={COLORS.primary}
            fill="url(#gradSubmissions)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="completionsCount"
            name="Completions"
            stroke={COLORS.success}
            fill="url(#gradCompletions)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Chart 2 — Top contributors bar chart
// ─────────────────────────────────────────────────────────────────────────────
interface TopContributorsChartProps {
  contributors: ContributorStats[];
  limit?: number;
}

export const TopContributorsChart: React.FC<TopContributorsChartProps> = ({
  contributors,
  limit = 10,
}) => {
  const data = contributors
    .slice(0, limit)
    .map((c) => ({
      handle: `@${c.githubHandle}`,
      reputation: c.reputation,
      earned: c.totalEarned,
      completed: c.bountiesCompleted,
    }));

  return (
    <div className="chart-card">
      <h3 className="chart-title">Top Contributors by Reputation</h3>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 12 }} stroke="#475569" />
          <YAxis
            type="category"
            dataKey="handle"
            tick={{ fontSize: 12 }}
            stroke="#475569"
            width={80}
          />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
            formatter={(value: number, name: string) =>
              name === 'earned' ? [`${fmtFND(value)} $FNDRY`, 'Earned'] : [value, name]
            }
          />
          <Legend />
          <Bar dataKey="reputation" name="Reputation" fill={COLORS.primary} radius={[0, 4, 4, 0]} />
          <Bar dataKey="completed"  name="Completed"  fill={COLORS.success}  radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Chart 3 — Bounty completion rates (pie + bar)
// ─────────────────────────────────────────────────────────────────────────────
interface CompletionRateChartProps {
  stats: BountyCompletionStat[];
}

export const CompletionRateChart: React.FC<CompletionRateChartProps> = ({ stats }) => {
  // Aggregate for pie chart
  const totals = stats.reduce(
    (acc, s) => ({
      completed: acc.completed + s.completed,
      pending:   acc.pending   + s.pending,
      cancelled: acc.cancelled + s.cancelled,
    }),
    { completed: 0, pending: 0, cancelled: 0 },
  );

  const pieData = [
    { name: 'Completed', value: totals.completed, color: COLORS.success },
    { name: 'Pending',   value: totals.pending,   color: COLORS.warning },
    { name: 'Cancelled', value: totals.cancelled,  color: COLORS.danger  },
  ];

  return (
    <div className="chart-card">
      <h3 className="chart-title">Bounty Completion Rates by Tier</h3>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        {/* Pie: overall breakdown */}
        <ResponsiveContainer width="40%" height={260}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {pieData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Bar: per-tier breakdown */}
        <ResponsiveContainer width="55%" height={260}>
          <BarChart data={stats} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="tier" tick={{ fontSize: 12 }} stroke="#475569" />
            <YAxis tick={{ fontSize: 12 }} stroke="#475569" />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
            />
            <Legend />
            <Bar dataKey="completed"  name="Completed"  fill={COLORS.success} stackId="a" />
            <Bar dataKey="pending"    name="Pending"    fill={COLORS.warning}  stackId="a" />
            <Bar dataKey="cancelled"  name="Cancelled"  fill={COLORS.danger}   stackId="a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Reward totals by tier */}
      <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
        {stats.map((s) => (
          <div key={s.tier} style={{ background: '#1e293b', borderRadius: 8, padding: '8px 16px', minWidth: 100 }}>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Tier {s.tier}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: COLORS[s.tier] }}>
              {fmtFND(s.totalRewardPaid)} $FNDRY
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>paid out</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Chart 4 — Reward trend over time
// ─────────────────────────────────────────────────────────────────────────────
interface RewardTrendChartProps {
  data: DailyActivity[];
}

export const RewardTrendChart: React.FC<RewardTrendChartProps> = ({ data }) => {
  const formatted = data.map((d) => ({
    date: fmtDate(d.date),
    reward: d.totalRewardPaid,
  }));

  return (
    <div className="chart-card">
      <h3 className="chart-title">Daily Rewards Paid ($FNDRY)</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={formatted} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#475569" />
          <YAxis tickFormatter={fmtFND} tick={{ fontSize: 11 }} stroke="#475569" />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
            formatter={(v: number) => [`${fmtFND(v)} $FNDRY`, 'Rewards']}
          />
          <Line
            type="monotone"
            dataKey="reward"
            stroke={COLORS.warning}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
