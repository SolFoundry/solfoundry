import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, GitPullRequest, DollarSign, Settings, Flame, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useAuth } from '../../hooks/useAuth';
import { useBounties } from '../../hooks/useBounties';
import { useGitHubActivity, useContributorStats, useEarningsHistory } from '../../hooks/useGitHubActivity';
import { ActivityChart, EarningsChart } from './ActivityCharts';
import { timeAgo, formatCurrency } from '../../lib/utils';
import { fadeIn, staggerContainer, staggerItem } from '../../lib/animations';
import type { Bounty } from '../../types/bounty';

const TABS = ['Overview', 'My Bounties', 'My Submissions', 'Earnings', 'Settings'] as const;
type Tab = typeof TABS[number];

const MONTHLY_MOCK = [
  { month: 'Jan', usdc: 200, fndry: 0 },
  { month: 'Feb', usdc: 500, fndry: 50000 },
  { month: 'Mar', usdc: 150, fndry: 0 },
  { month: 'Apr', usdc: 800, fndry: 100000 },
];

function BountyStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: 'text-emerald bg-emerald-bg border-emerald-border',
    funded: 'text-status-info bg-status-info/10 border-status-info/20',
    in_review: 'text-magenta bg-magenta-bg border-magenta-border',
    completed: 'text-text-muted bg-forge-800 border-border',
    cancelled: 'text-status-error bg-status-error/10 border-status-error/20',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status] ?? styles.open}`}>
      {status}
    </span>
  );
}

function OverviewTab({ user }: { user: any }) {
  const { data: activity, loading: activityLoading } = useGitHubActivity(user?.username, 30);
  const { data: stats, loading: statsLoading } = useContributorStats(user?.username);
  const { data: earnings, loading: earningsLoading } = useEarningsHistory(user?.id);
  const { data: bountiesData } = useBounties({ limit: 50 });

  const myBounties = bountiesData?.items.filter((b) => b.creator_id === user.id) ?? [];
  const totalEarned = earnings.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-border bg-forge-900 p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-emerald" />
            <span className="text-xs text-text-muted">Total Earned</span>
          </div>
          <p className="font-mono text-xl font-bold text-emerald">
            {(totalEarned / 1000).toFixed(0)}K
          </p>
          <p className="text-xs text-text-muted mt-1">FNDRY</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-border bg-forge-900 p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <GitPullRequest className="w-4 h-4 text-magenta" />
            <span className="text-xs text-text-muted">Bounties</span>
          </div>
          <p className="font-mono text-xl font-bold text-text-primary">
            {myBounties.length}
          </p>
          <p className="text-xs text-text-muted mt-1">completed</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border border-border bg-forge-900 p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Flame className="w-4 h-4 text-amber" />
            <span className="text-xs text-text-muted">Streak</span>
          </div>
          <p className="font-mono text-xl font-bold text-amber">
            {stats?.currentStreak ?? 0}
          </p>
          <p className="text-xs text-text-muted mt-1">days</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl border border-border bg-forge-900 p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald" />
            <span className="text-xs text-text-muted">Longest</span>
          </div>
          <p className="font-mono text-xl font-bold text-text-primary">
            {stats?.longestStreak ?? 0}
          </p>
          <p className="text-xs text-text-muted mt-1">days</p>
        </motion.div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ActivityChart data={activity} loading={activityLoading} />
        <EarningsChart data={earnings} loading={earningsLoading} />
      </div>

      {/* Contribution Stats */}
      {!statsLoading && stats && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-border bg-forge-900 p-4"
        >
          <p className="text-sm font-medium text-text-secondary mb-3">Contribution Summary</p>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="font-mono text-lg font-bold text-emerald">{stats.totalCommits}</p>
              <p className="text-xs text-text-muted">Commits</p>
            </div>
            <div>
              <p className="font-mono text-lg font-bold text-magenta">{stats.totalPullRequests}</p>
              <p className="text-xs text-text-muted">Pull Requests</p>
            </div>
            <div>
              <p className="font-mono text-lg font-bold text-amber">{stats.totalIssues}</p>
              <p className="text-xs text-text-muted">Issues</p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function MyBountiesTab({ bounties, loading }: { bounties: Bounty[]; loading: boolean }) {
  if (loading) {
    return <div className="text-text-muted text-sm py-8 text-center">Loading...</div>;
  }
  if (!bounties.length) {
    return (
      <div className="text-center py-12">
        <p className="text-text-muted mb-2">You haven't created any bounties yet.</p>
        <a href="/bounties/create" className="text-sm text-emerald hover:text-emerald-light transition-colors">
          Post your first bounty 鈫?        </a>
      </div>
    );
  }
  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-2">
      {bounties.map((b) => (
        <motion.div
          key={b.id}
          variants={staggerItem}
          className="flex items-center gap-4 px-4 py-3 rounded-lg bg-forge-900 border border-border hover:bg-forge-850 transition-colors cursor-pointer"
          onClick={() => window.location.href = `/bounties/${b.id}`}
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">{b.title}</p>
            <p className="text-xs text-text-muted mt-0.5">{timeAgo(b.created_at)}</p>
          </div>
          <span className="font-mono text-sm font-semibold text-emerald">{formatCurrency(b.reward_amount, b.reward_token)}</span>
          <BountyStatusBadge status={b.status} />
          <span className="text-xs text-text-muted inline-flex items-center gap-1">
            <GitPullRequest className="w-3.5 h-3.5" /> {b.submission_count}
          </span>
        </motion.div>
      ))}
    </motion.div>
  );
}

function SubmissionsTab() {
  return (
    <div className="text-center py-12">
      <p className="text-text-muted text-sm">No submissions yet.</p>
      <a href="/" className="text-sm text-emerald hover:text-emerald-light transition-colors mt-2 block">
        Browse open bounties 鈫?      </a>
    </div>
  );
}

function EarningsTab() {
  const totalEarned = MONTHLY_MOCK.reduce((s, m) => s + m.usdc, 0);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Earned', value: `$${totalEarned}`, color: 'text-emerald' },
          { label: 'This Month', value: '$800', color: 'text-emerald' },
          { label: 'Pending', value: '$0', color: 'text-text-muted' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-forge-900 p-4">
            <p className="text-xs text-text-muted mb-1">{s.label}</p>
            <p className={`font-mono text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-forge-900 p-4">
        <p className="text-sm font-medium text-text-secondary mb-4">Monthly Earnings</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={MONTHLY_MOCK} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#5C5C78', fontSize: 12, fontFamily: 'JetBrains Mono' }} />
            <YAxis hide />
            <Tooltip
              contentStyle={{ backgroundColor: '#16161F', border: '1px solid #1E1E2E', borderRadius: 8, fontFamily: 'JetBrains Mono', fontSize: 12 }}
              labelStyle={{ color: '#A0A0B8' }}
              itemStyle={{ color: '#00E676' }}
            />
            <Bar dataKey="usdc" radius={[4, 4, 0, 0]} fill="#00E676" opacity={0.85} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function SettingsTab() {
  const { user } = useAuth();
  return (
    <div className="space-y-6 max-w-lg">
      <div className="rounded-xl border border-border bg-forge-900 p-5">
        <h3 className="font-sans text-base font-semibold text-text-primary mb-4">GitHub Account</h3>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Username</span>
            <span className="text-text-primary font-medium">{user?.username}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Email</span>
            <span className="text-text-primary">{user?.email ?? '鈥?}</span>
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-forge-900 p-5">
        <h3 className="font-sans text-base font-semibold text-text-primary mb-2">Solana Wallet</h3>
        <p className="text-sm text-text-muted">
          {user?.wallet_address ? (
            <span className="font-mono">{user.wallet_address}</span>
          ) : (
            'No wallet linked. Link a wallet to receive FNDRY payouts.'
          )}
        </p>
      </div>
    </div>
  );
}

export function ProfileDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const { data: bountiesData, isLoading } = useBounties({ limit: 50 });

  if (!user) return null;

  const joinDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : 'Recently';

  const myBounties = bountiesData?.items.filter((b) => b.creator_id === user.id) ?? [];

  return (
    <motion.div variants={fadeIn} initial="initial" animate="animate" className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="rounded-xl border border-border bg-forge-900 p-6 mb-6">
        <div className="flex items-start gap-5">
          {user.avatar_url ? (
            <img src={user.avatar_url} className="w-16 h-16 rounded-full border-2 border-border" alt={user.username} />
          ) : (
            <div className="w-16 h-16 rounded-full bg-forge-700 border-2 border-border flex items-center justify-center">
              <span className="font-display text-2xl text-text-muted">{user.username[0]?.toUpperCase()}</span>
            </div>
          )}
          <div className="flex-1">
            <h1 className="font-sans text-2xl font-semibold text-text-primary">{user.username}</h1>
            <p className="mt-1 font-mono text-sm text-text-muted">
              Joined {joinDate} 路 {myBounties.length} bounties created
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-forge-800 mt-6 w-fit overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-forge-700 text-text-primary'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'Overview' && <OverviewTab user={user} />}
        {activeTab === 'My Bounties' && <MyBountiesTab bounties={myBounties} loading={isLoading} />}
        {activeTab === 'My Submissions' && <SubmissionsTab />}
        {activeTab === 'Earnings' && <EarningsTab />}
        {activeTab === 'Settings' && <SettingsTab />}
      </div>
    </motion.div>
  );
}