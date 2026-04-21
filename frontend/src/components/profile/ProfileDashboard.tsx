import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, GitPullRequest, DollarSign, Settings, Flame, Trophy } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { useAuth } from '../../hooks/useAuth';
import { useBounties } from '../../hooks/useBounties';
import { timeAgo, formatCurrency } from '../../lib/utils';
import { fadeIn, staggerContainer, staggerItem } from '../../lib/animations';
import type { Bounty } from '../../types/bounty';

const TABS = ['My Bounties', 'My Submissions', 'Activity', 'Earnings', 'Settings'] as const;
type Tab = typeof TABS[number];

const MONTHLY_MOCK = [
  { month: 'Jan', usdc: 200, fndry: 0 },
  { month: 'Feb', usdc: 500, fndry: 50000 },
  { month: 'Mar', usdc: 150, fndry: 0 },
  { month: 'Apr', usdc: 800, fndry: 100000 },
];

type GitHubActivityPoint = {
  date: string;
  commits: number;
  prs: number;
  issues: number;
};

function buildEmptyActivity(): GitHubActivityPoint[] {
  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (13 - index));
    return {
      date: date.toISOString().slice(5, 10),
      commits: 0,
      prs: 0,
      issues: 0,
    };
  });
}

function calculateStreak(activity: GitHubActivityPoint[]): number {
  let streak = 0;
  for (let i = activity.length - 1; i >= 0; i -= 1) {
    const point = activity[i];
    if (point.commits + point.prs + point.issues === 0) break;
    streak += 1;
  }
  return streak;
}

function useGitHubActivity(username?: string) {
  const [activity, setActivity] = useState<GitHubActivityPoint[]>(buildEmptyActivity);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    setLoading(true);

    fetch(`https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=100`)
      .then((response) => (response.ok ? response.json() : []))
      .then((events: Array<{ type: string; created_at: string; payload?: { commits?: unknown[]; action?: string } }>) => {
        if (cancelled) return;
        const points = buildEmptyActivity();
        const byDate = new Map(points.map((point) => [point.date, point]));

        events.forEach((event) => {
          const key = new Date(event.created_at).toISOString().slice(5, 10);
          const point = byDate.get(key);
          if (!point) return;

          if (event.type === 'PushEvent') point.commits += event.payload?.commits?.length || 1;
          if (event.type === 'PullRequestEvent' && event.payload?.action === 'opened') point.prs += 1;
          if (event.type === 'IssuesEvent' && event.payload?.action === 'opened') point.issues += 1;
        });

        setActivity(points);
      })
      .catch(() => {
        if (!cancelled) setActivity(buildEmptyActivity());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [username]);

  return { activity, loading };
}

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

function SubmissionsTab() {
  return (
    <div className="text-center py-12">
      <p className="text-text-muted text-sm">No submissions yet.</p>
      <a href="/" className="text-sm text-emerald hover:text-emerald-light transition-colors mt-2 block">
        Browse open bounties →
      </a>
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

function ActivityTab({ activity, loading }: { activity: GitHubActivityPoint[]; loading: boolean }) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-forge-900 p-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <p className="text-sm font-medium text-text-secondary">GitHub Activity</p>
          {loading && <span className="font-mono text-xs text-text-muted">syncing</span>}
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={activity} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#1E1E2E" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#5C5C78', fontSize: 12, fontFamily: 'JetBrains Mono' }} />
            <YAxis allowDecimals={false} width={28} axisLine={false} tickLine={false} tick={{ fill: '#5C5C78', fontSize: 12, fontFamily: 'JetBrains Mono' }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#16161F', border: '1px solid #1E1E2E', borderRadius: 8, fontFamily: 'JetBrains Mono', fontSize: 12 }}
              labelStyle={{ color: '#A0A0B8' }}
            />
            <Line type="monotone" dataKey="commits" stroke="#00E676" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="prs" stroke="#40C4FF" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="issues" stroke="#E040FB" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-3 gap-3 text-xs text-text-muted">
        <span className="inline-flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald" /> Commits</span>
        <span className="inline-flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-status-info" /> PRs</span>
        <span className="inline-flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-magenta" /> Issues</span>
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
  const [activeTab, setActiveTab] = useState<Tab>('My Bounties');
  const { data: bountiesData, isLoading } = useBounties({ limit: 50 });
  const { activity, loading: activityLoading } = useGitHubActivity(user?.username);

  if (!user) return null;

  const joinDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : 'Recently';

  const myBounties = bountiesData?.items.filter((b) => b.creator_id === user.id) ?? [];
  const completedBounties = myBounties.filter((b) => b.status === 'completed').length;
  const totalEarned = MONTHLY_MOCK.reduce((sum, item) => sum + item.usdc, 0);
  const contributionStreak = useMemo(() => calculateStreak(activity), [activity]);

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
              Joined {joinDate} · {myBounties.length} bounties created
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
          {[
            { label: 'Total Earned', value: `$${totalEarned.toLocaleString()}`, icon: DollarSign, color: 'text-emerald' },
            { label: 'Completed', value: completedBounties.toString(), icon: Trophy, color: 'text-status-info' },
            { label: 'Contributions', value: activity.reduce((sum, point) => sum + point.commits + point.prs + point.issues, 0).toString(), icon: GitPullRequest, color: 'text-magenta' },
            { label: 'Streak', value: `${contributionStreak}d`, icon: Flame, color: 'text-status-warning' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-lg border border-border bg-forge-850 p-3">
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
                {stat.label}
              </div>
              <p className={`mt-2 font-mono text-xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-forge-800 mt-6 w-fit">
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
        {activeTab === 'My Bounties' && <MyBountiesTab bounties={myBounties} loading={isLoading} />}
        {activeTab === 'My Submissions' && <SubmissionsTab />}
        {activeTab === 'Activity' && <ActivityTab activity={activity} loading={activityLoading} />}
        {activeTab === 'Earnings' && <EarningsTab />}
        {activeTab === 'Settings' && <SettingsTab />}
      </div>
    </motion.div>
  );
}
