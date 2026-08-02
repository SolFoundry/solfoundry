import React from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';
import { GitCommit, GitPullRequest, Bug, Flame, Activity, Calendar } from 'lucide-react';
import { staggerContainer, staggerItem } from '../../lib/animations';
import type { GitHubActivityEvent, GitHubStats } from '../../api/github';

interface GitHubActivityGraphProps {
  events: GitHubActivityEvent[];
  stats: GitHubStats;
  isLoading: boolean;
  isError: boolean;
  username?: string;
}

function Skeleton() {
  return (
    <div className="rounded-xl border border-border bg-forge-900 p-5 animate-pulse space-y-4">
      <div className="h-5 w-40 bg-forge-700 rounded" />
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 bg-forge-700 rounded-lg" />
        ))}
      </div>
      <div className="h-40 bg-forge-700 rounded-lg" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-border bg-forge-900 p-8 text-center">
      <Activity className="w-10 h-10 text-text-muted mx-auto mb-3" />
      <p className="text-text-muted text-sm">No GitHub activity data available yet.</p>
      <p className="text-text-muted text-xs mt-1">Activity will appear once you start contributing.</p>
    </div>
  );
}

function ErrorState() {
  return (
    <div className="rounded-xl border border-border bg-forge-900 p-8 text-center">
      <Bug className="w-10 h-10 text-status-error mx-auto mb-3" />
      <p className="text-text-muted text-sm">Unable to load GitHub activity.</p>
      <p className="text-text-muted text-xs mt-1">The GitHub API may be temporarily unavailable.</p>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, color }: {
  icon: React.FC<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="rounded-lg bg-forge-800 border border-border p-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ backgroundColor: `${color}15` } as React.CSSProperties}>
        <Icon className="w-4 h-4" style={{ color } as React.CSSProperties} />
      </div>
      <div>
        <p className="text-xs text-text-muted">{label}</p>
        <p className="font-mono text-sm font-semibold text-text-primary">{value}</p>
      </div>
    </div>
  );
}

export function GitHubActivityGraph({
  events,
  stats,
  isLoading,
  isError,
  username,
}: GitHubActivityGraphProps) {
  if (isLoading) return <Skeleton />;
  if (isError) return <ErrorState />;
  if (!events.length) return <EmptyState />;

  // Prepare chart data: last 30 days for readability
  const chartData = events.slice(-30);

  // Aggregate by week for the bar chart
  const weeklyData = chartData.reduce<Record<string, { week: string; commits: number; prs: number; issues: number }>>(
    (acc, day) => {
      const date = new Date(day.date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().slice(0, 10);
      if (!acc[weekKey]) {
        acc[weekKey] = { week: weekKey, commits: 0, prs: 0, issues: 0 };
      }
      acc[weekKey].commits += day.commits;
      acc[weekKey].prs += day.prs;
      acc[weekKey].issues += day.issues;
      return acc;
    },
    {},
  );

  const barData = Object.values(weeklyData).sort((a, b) => a.week.localeCompare(b.week));

  // Format week label
  const formatWeek = (dateStr: string) => {
    const d = new Date(dateStr);
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    const day = d.getDate();
    return `${month} ${day}`;
  };

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-forge-800 border border-border rounded-lg p-3 shadow-xl font-mono text-xs">
        <p className="text-text-muted mb-2">{formatWeek(label || '')}</p>
        {payload.map((entry, i) => (
          <p key={i} style={{ color: entry.color }} className="flex justify-between gap-4">
            <span>{entry.name}</span>
            <span className="font-semibold">{entry.value}</span>
          </p>
        ))}
      </div>
    );
  };

  // Activity heatmap data (simplified - contribution dots)
  const heatmapData = events.slice(-84); // 12 weeks
  const weeks: { date: string; count: number }[][] = [];
  let currentWeek: { date: string; count: number }[] = [];

  for (const day of heatmapData) {
    const date = new Date(day.date);
    const count = day.commits + day.prs + day.issues;
    if (currentWeek.length > 0 && date.getDay() === 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    currentWeek.push({ date: day.date, count });
  }
  if (currentWeek.length > 0) weeks.push(currentWeek);

  const getHeatColor = (count: number) => {
    if (count === 0) return 'bg-forge-800';
    if (count <= 2) return 'bg-emerald/30';
    if (count <= 5) return 'bg-emerald/50';
    if (count <= 10) return 'bg-emerald/70';
    return 'bg-emerald';
  };

  const GREEN = '#00E676';
  const BLUE = '#40C4FF';
  const PURPLE = '#7C3AED';

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="rounded-xl border border-border bg-forge-900 p-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald" />
          <h3 className="font-sans text-base font-semibold text-text-primary">
            {username ? `${username}'s GitHub Activity` : 'GitHub Activity'}
          </h3>
        </div>
        <a
          href={`https://github.com/${username}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          View profile →
        </a>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        <MiniStat icon={GitCommit} label="Commits" value={stats.totalCommits} color={GREEN} />
        <MiniStat icon={GitPullRequest} label="PRs" value={stats.totalPRs} color={BLUE} />
        <MiniStat icon={Bug} label="Issues" value={stats.totalIssues} color={PURPLE} />
        <MiniStat icon={Calendar} label="Active Days" value={stats.activeDays} color="#E040FB" />
      </div>

      {/* Weekly bar chart */}
      <div className="mb-5">
        <p className="text-xs text-text-muted mb-3 font-medium uppercase tracking-wider">Weekly Activity</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={barData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
            <XAxis
              dataKey="week"
              tickFormatter={formatWeek}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#5C5C78', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              interval="preserveStartEnd"
            />
            <YAxis hide />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="commits" stackId="a" radius={[2, 2, 0, 0]} fill={GREEN} opacity={0.85} />
            <Bar dataKey="prs" stackId="a" radius={[2, 2, 0, 0]} fill={BLUE} opacity={0.75} />
            <Bar dataKey="issues" stackId="a" radius={[2, 2, 0, 0]} fill={PURPLE} opacity={0.65} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Activity heatmap */}
      <div>
        <p className="text-xs text-text-muted mb-3 font-medium uppercase tracking-wider">
          Contribution Heatmap (12 weeks)
        </p>
        <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-none">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {week.map((day) => (
                <div
                  key={day.date}
                  className={`w-3 h-3 rounded-sm ${getHeatColor(day.count)}`}
                  title={`${day.date}: ${day.count} contributions`}
                />
              ))}
            </div>
          ))}
          {/* Legend */}
          <div className="flex items-end gap-1 ml-3 pb-0.5">
            <div className="w-3 h-3 rounded-sm bg-forge-800" title="No activity" />
            <div className="w-3 h-3 rounded-sm bg-emerald/30" title="1-2 contributions" />
            <div className="w-3 h-3 rounded-sm bg-emerald/50" title="3-5 contributions" />
            <div className="w-3 h-3 rounded-sm bg-emerald/70" title="6-10 contributions" />
            <div className="w-3 h-3 rounded-sm bg-emerald" title="10+ contributions" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}