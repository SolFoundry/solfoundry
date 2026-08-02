import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Clock, GitPullRequest, DollarSign, Settings, Activity,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import { useAuth } from '../../hooks/useAuth';
import { useBounties } from '../../hooks/useBounties';
import { useGitHubActivity } from '../../hooks/useGitHubActivity';
import { useProfileStats } from '../../hooks/useProfileStats';
import { StatsOverview } from './StatsOverview';
import { GitHubActivityGraph } from './GitHubActivityGraph';
import { timeAgo, formatCurrency, formatFndry, formatUsd } from '../../lib/utils';
import { fadeIn, staggerContainer, staggerItem } from '../../lib/animations';
import type { Bounty } from '../../types/bounty';

const TABS = ['Overview', 'My Bounties', 'My Submissions', 'Earnings', 'Settings'] as const;
type Tab = typeof TABS[number];

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

function MyBountiesTab({ bounties, loading }: { bounties: Bounty[]; loading: boolean }) {
  if (loading) {
    return <div className="text-text-muted text-sm py-8 text-center">Loading...</div>;
  }
  if (!bounties.length) {
    return (
      <div className="text-center py-12">
        <p className="text-text-muted mb-2">You haven't created any bounties yet.</p>
        <a href="/bounties/create" className="text-sm text-emerald hover:text-emerald-light transition-colors">
          Post your first bounty →
        </a>
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

function SubmissionsTab({ bounties, loading }: { bounties: Bounty[]; loading: boolean }) {
  if (loading) {
    return <div className="text-text-muted text-sm py-8 text-center">Loading...</div>;
  }

  // Count bounties by status for the user
  const completedCount = bounties.filter(b => b.status === 'completed').length;
  const inReviewCount = bounties.filter(b => b.status === 'in_review').length;
  const openCount = bounties.filter(b => b.status === 'open').length;

  if (!bounties.length) {
    return (
      <div className="text-center py-12">
        <p className="text-text-muted text-sm">No submissions yet.</p>
        <a href="/" className="text-sm text-emerald hover:text-emerald-light transition-colors mt-2 block">
          Browse open bounties →
        </a>
      </div>
    );
  }

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Completed', value: completedCount, color: 'text-emerald' },
          { label: 'In Review', value: inReviewCount, color: 'text-magenta' },
          { label: 'Active', value: openCount, color: 'text-status-info' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-forge-900 p-4 text-center">
            <p className={`font-mono text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-text-muted mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Bounty list as submissions */}
      <p className="text-sm text-text-secondary font-medium">Recent Bounty Activity</p>
      {bounties.slice(0, 10).map((b) => (
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
          <BountyStatusBadge status={b.status} />
        </motion.div>
      ))}
    </motion.div>
  );
}

interface EarningsTabProps {
  stats: {
    totalEarned: number;
    earnedFndry: number;
    earnedUsdc: number;
    bountiesCompleted: number;
    earningsHistory: { month: string; usdc: number; fndry: number }[];
  };
  isLoading: boolean;
}

function EarningsTab({ stats, isLoading }: EarningsTabProps) {
  // Use provided stats, or fall back to existing mock data
  const history = stats.earningsHistory.length > 0
    ? stats.earningsHistory
    : [
        { month: 'Jan', usdc: 200, fndry: 0 },
        { month: 'Feb', usdc: 500, fndry: 50000 },
        { month: 'Mar', usdc: 150, fndry: 0 },
        { month: 'Apr', usdc: 800, fndry: 100000 },
        { month: 'May', usdc: 0, fndry: 250000 },
        { month: 'Jun', usdc: 1200, fndry: 0 },
      ];

  const totalUsdc = history.reduce((s, m) => s + m.usdc, 0);
  const totalFndry = history.reduce((s, m) => s + m.fndry, 0);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-forge-900 p-4 h-20" />
          ))}
        </div>
        <div className="rounded-xl border border-border bg-forge-900 p-4 h-48" />
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-forge-800 border border-border rounded-lg p-3 shadow-xl font-mono text-xs">
        <p className="text-text-muted mb-2">{label}</p>
        {payload.map((entry, i) => (
          <p key={i} style={{ color: entry.color } as React.CSSProperties} className="flex justify-between gap-4">
            <span>{entry.name}</span>
            <span className="font-semibold">{entry.name === 'USDC' ? `$${entry.value}` : `${formatFndry(entry.value)} FNDRY`}</span>
          </p>
        ))}
      </div>
    );
  };

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="rounded-xl border border-border bg-forge-900 p-4">
          <p className="text-xs text-text-muted mb-1">Total Earned</p>
          <p className="font-mono text-xl font-bold text-emerald">{formatUsd(totalUsdc)}</p>
          <p className="text-xs text-text-muted mt-0.5">+{formatFndry(totalFndry)} FNDRY</p>
        </div>
        <div className="rounded-xl border border-border bg-forge-900 p-4">
          <p className="text-xs text-text-muted mb-1">Bounties Done</p>
          <p className="font-mono text-xl font-bold text-purple">{stats.bountiesCompleted}</p>
        </div>
        <div className="rounded-xl border border-border bg-forge-900 p-4">
          <p className="text-xs text-text-muted mb-1">FNDRY Earned</p>
          <p className="font-mono text-xl font-bold text-magenta">{formatFndry(totalFndry)}</p>
        </div>
      </div>

      {/* Earnings chart */}
      <div className="rounded-xl border border-border bg-forge-900 p-4">
        <p className="text-sm font-medium text-text-secondary mb-4">Monthly Earnings</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#5C5C78', fontSize: 12, fontFamily: 'JetBrains Mono' }}
            />
            <YAxis hide />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="usdc" name="USDC" radius={[4, 4, 0, 0]} fill="#00E676" opacity={0.85} />
            <Bar dataKey="fndry" name="FNDRY" radius={[4, 4, 0, 0]} fill="#E040FB" opacity={0.65} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* FNDRY earnings area chart */}
      {history.some(h => h.fndry > 0) && (
        <div className="rounded-xl border border-border bg-forge-900 p-4">
          <p className="text-sm font-medium text-text-secondary mb-4">FNDRY Payouts Over Time</p>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="fndryGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#E040FB" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#E040FB" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#5C5C78', fontSize: 12, fontFamily: 'JetBrains Mono' }}
              />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="fndry"
                name="FNDRY"
                stroke="#E040FB"
                strokeWidth={2}
                fill="url(#fndryGradient)"
                dot={{ r: 3, fill: '#E040FB', strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
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
            <span className="text-text-primary">{user?.email ?? '—'}</span>
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
  const { data: bountiesData, isLoading: bountiesLoading } = useBounties({ limit: 50 });
  const { events: ghEvents, stats: ghStats, isLoading: ghLoading, isError: ghError } = useGitHubActivity(user?.username);
  const { stats: profileStats, isLoading: statsLoading } = useProfileStats(user?.id);

  if (!user) return null;

  const joinDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : 'Recently';

  const myBounties = bountiesData?.items.filter((b) => b.creator_id === user.id) ?? [];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Overview':
        return (
          <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-6">
            {/* Stats Overview */}
            <StatsOverview
              totalEarned={profileStats.totalEarned}
              earnedFndry={profileStats.earnedFndry}
              bountiesCompleted={profileStats.bountiesCompleted}
              submissionsMade={profileStats.submissionsMade}
              contributionStreak={profileStats.contributionStreak}
              rank={profileStats.rank}
              reputation={profileStats.reputation}
              isLoading={statsLoading}
            />

            {/* GitHub Activity Graph */}
            <GitHubActivityGraph
              events={ghEvents}
              stats={ghStats}
              isLoading={ghLoading}
              isError={ghError}
              username={user.username}
            />

            {/* Recent Bounties quick view */}
            <div className="rounded-xl border border-border bg-forge-900 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-sans text-base font-semibold text-text-primary">Recent Bounties</h3>
                <button
                  onClick={() => setActiveTab('My Bounties')}
                  className="text-xs text-text-muted hover:text-text-secondary transition-colors"
                >
                  View all →
                </button>
              </div>
              {myBounties.length > 0 ? (
                <div className="space-y-2">
                  {myBounties.slice(0, 5).map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center gap-4 px-3 py-2 rounded-lg bg-forge-800 border border-border hover:bg-forge-700 transition-colors cursor-pointer"
                      onClick={() => window.location.href = `/bounties/${b.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{b.title}</p>
                      </div>
                      <span className="font-mono text-xs font-semibold text-emerald">{formatCurrency(b.reward_amount, b.reward_token)}</span>
                      <BountyStatusBadge status={b.status} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-text-muted text-sm">No bounties created yet.</p>
                  <a href="/bounties/create" className="text-sm text-emerald hover:text-emerald-light transition-colors mt-2 inline-block">
                    Create your first bounty →
                  </a>
                </div>
              )}
            </div>
          </motion.div>
        );
      case 'My Bounties':
        return <MyBountiesTab bounties={myBounties} loading={bountiesLoading} />;
      case 'My Submissions':
        return <SubmissionsTab bounties={myBounties} loading={bountiesLoading} />;
      case 'Earnings':
        return (
          <EarningsTab
            stats={{
              totalEarned: profileStats.totalEarned,
              earnedFndry: profileStats.earnedFndry,
              earnedUsdc: profileStats.earnedUsdc,
              bountiesCompleted: profileStats.bountiesCompleted,
              earningsHistory: profileStats.earningsHistory,
            }}
            isLoading={statsLoading}
          />
        );
      case 'Settings':
        return <SettingsTab />;
    }
  };

  return (
    <motion.div variants={fadeIn} initial="initial" animate="animate" className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="rounded-xl border border-border bg-forge-900 p-6 mb-6">
        <div className="flex items-start gap-4 sm:gap-5">
          {user.avatar_url ? (
            <img src={user.avatar_url} className="w-16 h-16 rounded-full border-2 border-border" alt={user.username} />
          ) : (
            <div className="w-16 h-16 rounded-full bg-forge-700 border-2 border-border flex items-center justify-center">
              <span className="font-display text-2xl text-text-muted">{user.username[0]?.toUpperCase()}</span>
            </div>
          )}
          <div className="flex-1">
            <h1 className="font-sans text-xl sm:text-2xl font-semibold text-text-primary">{user.username}</h1>
            <p className="mt-1 font-mono text-sm text-text-muted">
              Joined {joinDate} · {myBounties.length} bounties created
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-forge-800 mt-6 w-fit overflow-x-auto scrollbar-none">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 ${
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
        {renderTabContent()}
      </div>
    </motion.div>
  );
}