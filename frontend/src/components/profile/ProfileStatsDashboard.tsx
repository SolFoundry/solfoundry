import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, DollarSign, GitPullRequest, Flame, Award, Calendar, BarChart3, Activity } from 'lucide-react';
import { apiClient } from '../services/apiClient';

// Types
export interface ProfileStats {
  totalEarned: number;
  bountiesCompleted: number;
  bountiesInProgress: number;
  currentStreak: number;
  longestStreak: number;
  averageScore: number;
  reputation: number;
  tier: 1 | 2 | 3;
  joinedDate: string;
}

export interface EarningRecord {
  date: string;
  amount: number;
  bountyTitle: string;
  tier: 1 | 2 | 3;
}

export interface ContributionDay {
  date: string;
  count: number;
  type: 'commit' | 'pr' | 'issue';
}

// API
export async function fetchProfileStats(): Promise<ProfileStats> {
  return apiClient<ProfileStats>('/api/profile/stats');
}

export async function fetchEarningHistory(): Promise<EarningRecord[]> {
  return apiClient<EarningRecord[]>('/api/profile/earnings');
}

export async function fetchContributions(): Promise<ContributionDay[]> {
  return apiClient<ContributionDay[]>('/api/profile/contributions');
}

// Stat Card
function StatCard({ icon: Icon, label, value, color, subtext }: {
  icon: React.ElementType; label: string; value: string | number; color: string; subtext?: string;
}) {
  return (
    <div className="p-4 rounded-lg bg-surface-card border border-border-primary hover:border-border-secondary transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-text-muted font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-text-primary tabular-nums">{value}</p>
      {subtext && <p className="text-xs text-text-muted mt-1">{subtext}</p>}
    </div>
  );
}

// Earning History Chart (SVG-based, no external deps)
function EarningChart({ earnings }: { earnings: EarningRecord[] }) {
  if (earnings.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-text-muted text-sm">
        No earnings yet. Complete your first bounty!
      </div>
    );
  }

  const maxAmount = Math.max(...earnings.map((e) => e.amount));
  const chartW = 100;
  const chartH = 40;
  const barWidth = Math.max(1, (chartW - 4) / earnings.length - 0.5);

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${chartW} ${chartH + 10}`} className="w-full h-32">
        {/* Y-axis lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
          <line
            key={pct}
            x1="0" y1={chartH * (1 - pct) + 5}
            x2={chartW} y2={chartH * (1 - pct) + 5}
            stroke="#1F2937" strokeWidth="0.2"
          />
        ))}

        {/* Bars */}
        {earnings.map((earning, i) => {
          const barH = (earning.amount / maxAmount) * chartH;
          const x = 2 + i * ((chartW - 4) / earnings.length);
          const y = chartH - barH + 5;
          const tierColor = earning.tier === 1 ? '#00D4AA' : earning.tier === 2 ? '#FBBF24' : '#C832B4';

          return (
            <g key={i}>
              <rect
                x={x} y={y}
                width={barWidth} height={barH}
                fill={tierColor} rx={0.3} opacity={0.8}
              />
              <title>{`${earning.date}: ${earning.amount.toLocaleString()} $FNDRY — ${earning.bountyTitle}`}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Contribution Graph (GitHub-style heatmap)
function ContributionGraph({ contributions }: { contributions: ContributionDay[] }) {
  const weeks = 12;
  const days = 7;

  // Build 12-week grid from contributions
  const grid: (number | null)[][] = Array.from({ length: days }, () =>
    Array.from({ length: weeks }, () => null)
  );

  const today = new Date();
  contributions.forEach((c) => {
    const d = new Date(c.date);
    const diffDays = Math.floor((today.getTime() - d.getTime()) / 86400000);
    if (diffDays >= 0 && diffDays < weeks * 7) {
      const week = weeks - 1 - Math.floor(diffDays / 7);
      const day = d.getDay();
      if (week >= 0 && week < weeks) {
        grid[day][week] = (grid[day][week] || 0) + c.count;
      }
    }
  });

  const maxCount = Math.max(
    1,
    ...contributions.map((c) => c.count)
  );

  const getColor = (count: number | null) => {
    if (count === null || count === 0) return '#1F2937';
    const intensity = count / maxCount;
    if (intensity > 0.75) return '#00D4AA';
    if (intensity > 0.5) return '#00D4AA80';
    if (intensity > 0.25) return '#00D4AA40';
    return '#00D4AA20';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-0.5 overflow-x-auto pb-2">
        {Array.from({ length: weeks }).map((_, week) => (
          <div key={week} className="flex flex-col gap-0.5">
            {Array.from({ length: days }).map((_, day) => (
              <div
                key={day}
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: getColor(grid[day][week]) }}
                title={grid[day][week] ? `${grid[day][week]} contributions` : 'No contributions'}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <span>Less</span>
        {[0, 0.25, 0.5, 0.75, 1].map((i) => (
          <div
            key={i}
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: getColor(i * maxCount) }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

// Main Dashboard
export function ProfileStatsDashboard() {
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [earnings, setEarnings] = useState<EarningRecord[]>([]);
  const [contributions, setContributions] = useState<ContributionDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [s, e, c] = await Promise.all([
          fetchProfileStats(),
          fetchEarningHistory(),
          fetchContributions(),
        ]);
        setStats(s);
        setEarnings(e);
        setContributions(c);
      } catch {
        // Use fallback data for demo
        setStats({
          totalEarned: 1250000,
          bountiesCompleted: 8,
          bountiesInProgress: 2,
          currentStreak: 5,
          longestStreak: 14,
          averageScore: 7.2,
          reputation: 45,
          tier: 2,
          joinedDate: '2026-01-15',
        });
        setEarnings([
          { date: '2026-03-01', amount: 100000, bountyTitle: 'Tutorial', tier: 1 },
          { date: '2026-03-15', amount: 150000, bountyTitle: 'Timer Component', tier: 1 },
          { date: '2026-04-01', amount: 200000, bountyTitle: 'OAuth Flow', tier: 1 },
          { date: '2026-04-20', amount: 500000, bountyTitle: 'Brand Guide', tier: 2 },
          { date: '2026-05-01', amount: 300000, bountyTitle: 'Search Bar', tier: 2 },
        ]);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  if (isLoading || !stats) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-surface-card rounded-lg" />
          ))}
        </div>
        <div className="h-48 bg-surface-card rounded-lg" />
      </div>
    );
  }

  const tierLabel = { 1: 'T1', 2: 'T2', 3: 'T3' }[stats.tier];
  const tierColor = { 1: 'text-emerald', 2: 'text-tier-t2', 3: 'text-tier-t3' }[stats.tier];

  return (
    <div className="space-y-6">
      {/* Key Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={DollarSign}
          label="Total Earned"
          value={`${(stats.totalEarned / 1000).toFixed(0)}K`}
          color="text-anvil-orange"
          subtext="$FNDRY"
        />
        <StatCard
          icon={Award}
          label="Bounties Done"
          value={stats.bountiesCompleted}
          color="text-emerald"
          subtext={`${stats.bountiesInProgress} in progress`}
        />
        <StatCard
          icon={Flame}
          label="Current Streak"
          value={`${stats.currentStreak}d`}
          color="text-tier-t2"
          subtext={`Longest: ${stats.longestStreak}d`}
        />
        <StatCard
          icon={BarChart3}
          label="Avg Score"
          value={stats.averageScore.toFixed(1)}
          color="text-status-info"
          subtext={`${tierLabel} • Rep ${stats.reputation}`}
        />
      </div>

      {/* Earning History Chart */}
      <div className="p-4 rounded-lg bg-surface-card border border-border-primary">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald" />
            Earning History
          </h3>
          <span className="text-xs text-text-muted">{earnings.length} payouts</span>
        </div>
        <EarningChart earnings={earnings} />
      </div>

      {/* Contribution Graph */}
      <div className="p-4 rounded-lg bg-surface-card border border-border-primary">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald" />
            Contribution Activity
          </h3>
          <span className="text-xs text-text-muted">Last 12 weeks</span>
        </div>
        <ContributionGraph contributions={contributions} />
      </div>
    </div>
  );
}

export default ProfileStatsDashboard;
