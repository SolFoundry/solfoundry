import React from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import type { GitHubActivity } from '../../api/github';

interface ActivityChartProps {
  data: GitHubActivity[];
  loading?: boolean;
}

export function ActivityChart({ data, loading }: ActivityChartProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-forge-900 p-4">
        <p className="text-sm font-medium text-text-secondary mb-4">GitHub Activity</p>
        <div className="h-40 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-emerald border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  // Aggregate for weekly view
  const weeklyData = data.reduce((acc, day) => {
    const date = new Date(day.date);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];
    
    const existing = acc.find(w => w.week === weekKey);
    if (existing) {
      existing.commits += day.commits;
      existing.pullRequests += day.pullRequests;
      existing.issues += day.issues;
    } else {
      acc.push({
        week: weekKey,
        label: `W${Math.ceil((date.getDate()) / 7)}`,
        commits: day.commits,
        pullRequests: day.pullRequests,
        issues: day.issues,
      });
    }
    return acc;
  }, [] as { week: string; label: string; commits: number; pullRequests: number; issues: number }[]);

  // Prepare chart data
  const chartData = data.slice(-14).map(d => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    total: d.commits + d.pullRequests + d.issues,
    commits: d.commits,
    pullRequests: d.pullRequests,
    issues: d.issues,
  }));

  const totalActivity = data.reduce((sum, d) => sum + d.commits + d.pullRequests + d.issues, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-forge-900 p-4"
    >
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-text-secondary">GitHub Activity</p>
        <span className="text-xs text-text-muted">{totalActivity} contributions in last 30 days</span>
      </div>
      
      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#64748B', fontSize: 10, fontFamily: 'JetBrains Mono' }}
            interval="preserveStartEnd"
          />
          <YAxis hide />
          <Tooltip
            contentStyle={{ 
              backgroundColor: '#16161F', 
              border: '1px solid #1E1E2E', 
              borderRadius: 8, 
              fontFamily: 'JetBrains Mono', 
              fontSize: 12 
            }}
            labelStyle={{ color: '#A0A0B8' }}
            itemStyle={{ color: '#10B981' }}
            formatter={(value: number, name: string) => [value, name === 'total' ? 'Activity' : name]}
          />
          <Area 
            type="monotone" 
            dataKey="total" 
            stroke="#10B981" 
            strokeWidth={2}
            fill="url(#activityGradient)" 
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-xs text-text-muted">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald" /> Commits
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-magenta" /> PRs
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber" /> Issues
        </span>
      </div>
    </motion.div>
  );
}

interface EarningsChartProps {
  data: { date: string; amount: number; token: string }[];
  loading?: boolean;
}

export function EarningsChart({ data, loading }: EarningsChartProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-forge-900 p-4">
        <div className="h-40 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-emerald border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  const chartData = data.map(d => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    amount: d.amount / 1000, // Display in K
  }));

  const total = data.reduce((sum, d) => sum + d.amount, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-forge-900 p-4"
    >
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-text-secondary">Earnings History</p>
        <span className="font-mono text-sm font-semibold text-emerald">
          {(total / 1000).toFixed(0)}K FNDRY
        </span>
      </div>

      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#64748B', fontSize: 10, fontFamily: 'JetBrains Mono' }}
          />
          <YAxis hide />
          <Tooltip
            contentStyle={{ 
              backgroundColor: '#16161F', 
              border: '1px solid #1E1E2E', 
              borderRadius: 8, 
              fontFamily: 'JetBrains Mono', 
              fontSize: 12 
            }}
            labelStyle={{ color: '#A0A0B8' }}
            itemStyle={{ color: '#10B981' }}
            formatter={(value: number) => [`${value}K FNDRY`, 'Earned']}
          />
          <Bar dataKey="amount" radius={[4, 4, 0, 0]} fill="#10B981" opacity={0.85} />
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}