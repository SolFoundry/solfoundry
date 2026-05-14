import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, CalendarDays, DollarSign, Flame, GitCommitHorizontal, GitPullRequest } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, Legend } from 'recharts';
import { useAuth } from '../../hooks/useAuth';
import { useBounties } from '../../hooks/useBounties';
import { timeAgo, formatCurrency } from '../../lib/utils';
import { fadeIn, staggerContainer, staggerItem } from '../../lib/animations';
import type { Bounty } from '../../types/bounty';

const TABS = ['My Bounties', 'Profile Stats', 'Settings'] as const;
type Tab = typeof TABS[number];

type GitHubWeek = {
  week: string;
  commits: number;
  prs: number;
  issues: number;
};

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
          onClick={() => (window.location.href = `/bounties/${b.id}`)}
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

function buildGithubWeeks(events: any[]): GitHubWeek[] {
  const map = new Map<string, GitHubWeek>();
  for (const e of events) {
    const d = new Date(e.created_at);
    const monday = new Date(d);
    const day = monday.getUTCDay() || 7;
    monday.setUTCDate(monday.getUTCDate() - day + 1);
    const key = monday.toISOString().slice(5, 10);

    if (!map.has(key)) map.set(key, { week: key, commits: 0, prs: 0, issues: 0 });
    const w = map.get(key)!;

    if (e.type === 'PushEvent') {
      w.commits += Array.isArray(e.payload?.commits) ? e.payload.commits.length : 1;
    }
    if (e.type === 'PullRequestEvent' && e.payload?.action === 'opened') {
      w.prs += 1;
    }
    if (e.type === 'IssuesEvent' && e.payload?.action === 'opened') {
      w.issues += 1;
    }
  }

  return Array.from(map.values())
    .sort((a, b) => a.week.localeCompare(b.week))
    .slice(-12);
}

function buildEarningsHistory(bounties: Bounty[]) {
  const monthMap = new Map<string, { month: string; earned: number }>();
  for (const b of bounties) {
    if (b.status !== 'completed') continue;
    const date = new Date(b.created_at);
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    if (!monthMap.has(month)) monthMap.set(month, { month, earned: 0 });
    const rewardInFndry = b.reward_token === 'FNDRY' ? b.reward_amount : b.reward_amount * 100;
    monthMap.get(month)!.earned += rewardInFndry;
  }

  const data = Array.from(monthMap.values());
  if (!data.length) {
    return [
      { month: 'Jan', earned: 0 },
      { month: 'Feb', earned: 0 },
      { month: 'Mar', earned: 0 },
      { month: 'Apr', earned: 0 },
    ];
  }
  return data;
}

function ProfileStatsTab({ username, bounties }: { username: string; bounties: Bounty[] }) {
  const [githubWeeks, setGithubWeeks] = useState<GitHubWeek[]>([]);
  const [loadingGitHub, setLoadingGitHub] = useState(true);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoadingGitHub(true);
      try {
        const res = await fetch(`https://api.github.com/users/${username}/events/public?per_page=100`);
        if (!res.ok) throw new Error('GitHub API unavailable');
        const events = await res.json();
        if (mounted) setGithubWeeks(buildGithubWeeks(events));
      } catch {
        if (mounted) setGithubWeeks([]);
      } finally {
        if (mounted) setLoadingGitHub(false);
      }
    };

    if (username) run();
    return () => {
      mounted = false;
    };
  }, [username]);

  const completed = bounties.filter((b) => b.status === 'completed').length;
  const totalEarned = bounties
    .filter((b) => b.status === 'completed')
    .reduce((sum, b) => sum + (b.reward_token === 'FNDRY' ? b.reward_amount : b.reward_amount * 100), 0);

  const streak = useMemo(() => {
    const days = new Set(
      bounties
        .map((b) => new Date(b.created_at).toISOString().slice(0, 10))
        .sort(),
    );
    const today = new Date();
    let current = 0;
    for (let i = 0; i < 365; i += 1) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      if (days.has(key)) current += 1;
      else if (i > 0) break;
    }
    return current;
  }, [bounties]);

  const earningHistory = useMemo(() => buildEarningsHistory(bounties), [bounties]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-forge-900 p-4">
          <p className="text-xs text-text-muted mb-1 inline-flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" />Total Earned</p>
          <p className="font-mono text-xl font-bold text-emerald">{totalEarned.toLocaleString()} FNDRY</p>
        </div>
        <div className="rounded-xl border border-border bg-forge-900 p-4">
          <p className="text-xs text-text-muted mb-1 inline-flex items-center gap-1"><Activity className="w-3.5 h-3.5" />Bounties Completed</p>
          <p className="font-mono text-xl font-bold text-text-primary">{completed}</p>
        </div>
        <div className="rounded-xl border border-border bg-forge-900 p-4">
          <p className="text-xs text-text-muted mb-1 inline-flex items-center gap-1"><Flame className="w-3.5 h-3.5" />Contribution Streak</p>
          <p className="font-mono text-xl font-bold text-text-primary">{streak} day{streak === 1 ? '' : 's'}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-forge-900 p-4">
        <p className="text-sm font-medium text-text-secondary mb-4 inline-flex items-center gap-2"><CalendarDays className="w-4 h-4" />Earning History (FNDRY)</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={earningHistory} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27273a" />
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#8E8EA9', fontSize: 12, fontFamily: 'JetBrains Mono' }} />
            <YAxis tick={{ fill: '#5C5C78', fontSize: 11 }} width={40} />
            <Tooltip contentStyle={{ backgroundColor: '#16161F', border: '1px solid #1E1E2E', borderRadius: 8, fontFamily: 'JetBrains Mono', fontSize: 12 }} />
            <Bar dataKey="earned" radius={[6, 6, 0, 0]} fill="#00E676" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-border bg-forge-900 p-4">
        <p className="text-sm font-medium text-text-secondary mb-2 inline-flex items-center gap-2"><GitCommitHorizontal className="w-4 h-4" />GitHub Activity (Commits / PRs / Issues)</p>
        {loadingGitHub ? (
          <p className="text-sm text-text-muted py-6 text-center">Loading GitHub activity…</p>
        ) : githubWeeks.length === 0 ? (
          <p className="text-sm text-text-muted py-6 text-center">No public GitHub activity found for recent weeks.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={githubWeeks} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27273a" />
              <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: '#8E8EA9', fontSize: 12 }} />
              <YAxis tick={{ fill: '#5C5C78', fontSize: 11 }} width={28} />
              <Tooltip contentStyle={{ backgroundColor: '#16161F', border: '1px solid #1E1E2E', borderRadius: 8, fontFamily: 'JetBrains Mono', fontSize: 12 }} />
              <Legend />
              <Line type="monotone" dataKey="commits" stroke="#00E676" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="prs" stroke="#7C4DFF" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="issues" stroke="#03A9F4" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
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
          {user?.wallet_address ? <span className="font-mono">{user.wallet_address}</span> : 'No wallet linked. Link a wallet to receive FNDRY payouts.'}
        </p>
      </div>
    </div>
  );
}

export function ProfileDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('My Bounties');
  const { data: bountiesData, isLoading } = useBounties({ limit: 50 });

  if (!user) return null;

  const joinDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : 'Recently';

  const myBounties = bountiesData?.items.filter((b) => b.creator_id === user.id) ?? [];

  return (
    <motion.div variants={fadeIn} initial="initial" animate="animate" className="max-w-5xl mx-auto px-4 py-8">
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
            <p className="mt-1 font-mono text-sm text-text-muted">Joined {joinDate} · {myBounties.length} bounties created</p>
          </div>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-forge-800 mt-6 w-fit">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 ${
                activeTab === tab ? 'bg-forge-700 text-text-primary' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div>
        {activeTab === 'My Bounties' && <MyBountiesTab bounties={myBounties} loading={isLoading} />}
        {activeTab === 'Profile Stats' && <ProfileStatsTab username={user.username} bounties={myBounties} />}
        {activeTab === 'Settings' && <SettingsTab />}
      </div>
    </motion.div>
  );
}
