import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { GitPullRequest, GitCommit, GitBranch, TrendingUp, Award, Flame } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { fadeIn, staggerContainer, staggerItem } from '../../lib/animations';

interface GitHubActivityData {
  week: string;
  commits: number;
  prs: number;
  issues: number;
}

interface EarningHistoryData {
  month: string;
  fnrdry: number;
  usdc: number;
}

const MOCK_GITHUB_ACTIVITY: GitHubActivityData[] = [
  { week: 'W1', commits: 12, prs: 2, issues: 5 },
  { week: 'W2', commits: 8, prs: 1, issues: 3 },
  { week: 'W3', commits: 15, prs: 3, issues: 7 },
  { week: 'W4', commits: 20, prs: 4, issues: 6 },
  { week: 'W5', commits: 11, prs: 2, issues: 4 },
  { week: 'W6', commits: 18, prs: 3, issues: 8 },
  { week: 'W7', commits: 25, prs: 5, issues: 10 },
  { week: 'W8', commits: 16, prs: 2, issues: 6 },
];

const MOCK_EARNINGS: EarningHistoryData[] = [
  { month: 'Jan', fnrdry: 0, usdc: 200 },
  { month: 'Feb', fnrdry: 50000, usdc: 500 },
  { month: 'Mar', fnrdry: 0, usdc: 150 },
  { month: 'Apr', fnrdry: 100000, usdc: 800 },
  { month: 'May', fnrdry: 75000, usdc: 300 },
  { month: 'Jun', fnrdry: 150000, usdc: 600 },
];

function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  color = 'text-emerald',
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subValue?: string;
  color?: string;
}) {
  return (
    <motion.div
      variants={staggerItem}
      className="rounded-xl border border-border bg-forge-900 p-4 flex items-start gap-3"
    >
      <div className={`mt-0.5 p-2 rounded-lg bg-forge-800 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-xs text-text-muted">{label}</p>
        <p className={`font-mono text-xl font-bold ${color}`}>{value}</p>
        {subValue && <p className="text-xs text-text-muted mt-0.5">{subValue}</p>}
      </div>
    </motion.div>
  );
}

function GitHubActivityChart({ data }: { data: GitHubActivityData[] }) {
  return (
    <div className="rounded-xl border border-border bg-forge-900 p-4">
      <p className="text-sm font-medium text-text-secondary mb-4">GitHub Activity (Last 8 Weeks)</p>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="gradCommits" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00E676" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#00E676" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradPRs" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#40C4FF" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#40C4FF" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="week"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#5C5C78', fontSize: 11, fontFamily: 'JetBrains Mono' }}
          />
          <YAxis hide />
          <Tooltip
            contentStyle={{
              backgroundColor: '#16161F',
              border: '1px solid #1E1E2E',
              borderRadius: 8,
              fontFamily: 'JetBrains Mono',
              fontSize: 12,
            }}
            labelStyle={{ color: '#A0A0B8' }}
          />
          <Area
            type="monotone"
            dataKey="commits"
            stroke="#00E676"
            fill="url(#gradCommits)"
            strokeWidth={1.5}
            name="Commits"
          />
          <Area
            type="monotone"
            dataKey="prs"
            stroke="#40C4FF"
            fill="url(#gradPRs)"
            strokeWidth={1.5}
            name="PRs"
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50">
        <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald" />
          Commits
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
          <span className="w-2.5 h-2.5 rounded-full bg-status-info" />
          Pull Requests
        </span>
      </div>
    </div>
  );
}

function EarningsHistoryChart({ data }: { data: EarningHistoryData[] }) {
  return (
    <div className="rounded-xl border border-border bg-forge-900 p-4">
      <p className="text-sm font-medium text-text-secondary mb-4">Earnings History</p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#5C5C78', fontSize: 11, fontFamily: 'JetBrains Mono' }}
          />
          <YAxis hide />
          <Tooltip
            contentStyle={{
              backgroundColor: '#16161F',
              border: '1px solid #1E1E2E',
              borderRadius: 8,
              fontFamily: 'JetBrains Mono',
              fontSize: 12,
            }}
            labelStyle={{ color: '#A0A0B8' }}
            formatter={(value: number, name: string) => [
              name === 'fnrdry' ? `${value.toLocaleString()} FNDRY` : `$${value}`,
              name === 'fnrdry' ? 'FNDRY' : 'USDC',
            ]}
          />
          <Bar dataKey="fnrdry" radius={[4, 4, 0, 0]} fill="#7C3AED" opacity={0.85} name="fnrdry" />
          <Bar dataKey="usdc" radius={[4, 4, 0, 0]} fill="#00E676" opacity={0.6} name="usdc" />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50">
        <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
          <span className="w-2.5 h-2.5 rounded-full bg-purple" />
          FNDRY
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald" />
          USDC
        </span>
      </div>
    </div>
  );
}

function ContributionBreakdown({ data }: { data: GitHubActivityData[] }) {
  const totalCommits = data.reduce((s, w) => s + w.commits, 0);
  const totalPRs = data.reduce((s, w) => s + w.prs, 0);
  const totalIssues = data.reduce((s, w) => s + w.issues, 0);

  return (
    <div className="rounded-xl border border-border bg-forge-900 p-4">
      <p className="text-sm font-medium text-text-secondary mb-4">Contribution Breakdown</p>
      <div className="space-y-3">
        {[
          { label: 'Commits', value: totalCommits, color: 'bg-emerald', icon: GitCommit },
          { label: 'Pull Requests', value: totalPRs, color: 'bg-status-info', icon: GitPullRequest },
          { label: 'Issues', value: totalIssues, color: 'bg-purple', icon: GitBranch },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="flex items-center gap-3">
            <Icon className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-xs text-text-muted w-24">{label}</span>
            <div className="flex-1 bg-forge-800 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full ${color} opacity-80`}
                style={{ width: `${Math.min(100, (value / Math.max(totalCommits, 1)) * 100)}%` }}
              />
            </div>
            <span className="font-mono text-xs text-text-primary w-8 text-right">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ContributorStats() {
  const totalEarned = MOCK_EARNINGS.reduce((s, m) => s + m.fnrdry, 0);
  const bountiesCompleted = 8;
  const streak = 14;

  return (
    <motion.div
      variants={fadeIn}
      initial="initial"
      animate="animate"
      className="max-w-4xl mx-auto px-4 py-8"
    >
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="space-y-6"
      >
        {/* Key Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            icon={TrendingUp}
            label="Total Earned"
            value={`${(totalEarned / 1000).toFixed(0)}K FNDRY`}
            subValue="~$1,750 USD equivalent"
            color="text-emerald"
          />
          <StatCard
            icon={Award}
            label="Bounties Completed"
            value={bountiesCompleted}
            subValue="across T1 and T2"
            color="text-purple"
          />
          <StatCard
            icon={Flame}
            label="Contribution Streak"
            value={`${streak} days`}
            subValue="Active this month"
            color="text-magenta"
          />
          <StatCard
            icon={GitPullRequest}
            label="PRs Merged"
            value={MOCK_GITHUB_ACTIVITY.reduce((s, w) => s + w.prs, 0)}
            subValue="Last 8 weeks"
            color="text-status-info"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <GitHubActivityChart data={MOCK_GITHUB_ACTIVITY} />
          <EarningsHistoryChart data={MOCK_EARNINGS} />
        </div>

        {/* Contribution Breakdown */}
        <ContributionBreakdown data={MOCK_GITHUB_ACTIVITY} />
      </motion.div>
    </motion.div>
  );
}
