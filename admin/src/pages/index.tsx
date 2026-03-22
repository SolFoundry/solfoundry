import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Award,
  Users,
  Wallet,
  TrendingUp,
  RefreshCw,
  CheckCircle,
  UserPlus,
  XCircle,
  DollarSign,
  PlusCircle,
} from 'lucide-react';
import { clsx } from 'clsx';
import { dashboard, bounties as bountiesApi, type ActivityEvent, type DashboardStats } from '../api/client';
import { StatsCard } from '../components/StatsCard';
import { formatDistanceToNow } from 'date-fns';

// ─── Activity feed item ───────────────────────────────────────────────────────

const activityIcon: Record<ActivityEvent['type'], React.ReactNode> = {
  bounty_created: <PlusCircle className="h-4 w-4 text-violet-400" />,
  bounty_completed: <CheckCircle className="h-4 w-4 text-emerald-400" />,
  bounty_closed: <XCircle className="h-4 w-4 text-red-400" />,
  contributor_joined: <UserPlus className="h-4 w-4 text-blue-400" />,
  payout_sent: <DollarSign className="h-4 w-4 text-amber-400" />,
};

function ActivityItem({ event }: { event: ActivityEvent }) {
  return (
    <li className="flex items-start gap-3 py-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-700/60">
        {activityIcon[event.type]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-200">{event.description}</p>
        {event.actor && (
          <p className="mt-0.5 text-xs text-slate-500">
            by <span className="font-mono text-slate-400">{event.actor}</span>
          </p>
        )}
      </div>
      <time className="shrink-0 text-xs text-slate-500" dateTime={event.timestamp}>
        {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
      </time>
    </li>
  );
}

// ─── Quick actions ────────────────────────────────────────────────────────────

function QuickActions() {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/60 p-5 backdrop-blur-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">Quick Actions</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'New Bounty', href: '/bounties?action=create', icon: <PlusCircle className="h-5 w-5" />, color: 'bg-violet-500/10 text-violet-400 hover:bg-violet-500/20' },
          { label: 'Review PRs', href: '/bounties?status=review', icon: <CheckCircle className="h-5 w-5" />, color: 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' },
          { label: 'Pending Approvals', href: '/contributors?status=pending', icon: <UserPlus className="h-5 w-5" />, color: 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20' },
          { label: 'Trigger Payout', href: '/treasury', icon: <DollarSign className="h-5 w-5" />, color: 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20' },
        ].map((action) => (
          <a
            key={action.label}
            href={action.href}
            className={clsx(
              'flex flex-col items-center gap-2 rounded-lg p-4 text-center text-xs font-medium transition-colors',
              action.color,
            )}
          >
            {action.icon}
            {action.label}
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── Bounty status breakdown ──────────────────────────────────────────────────

function StatusBreakdown({ stats }: { stats: DashboardStats }) {
  const completed = stats.completedBounties;
  const open = stats.openBounties;
  const other = stats.totalBounties - completed - open;

  const bars = [
    { label: 'Open', count: open, color: 'bg-violet-500', pct: (open / stats.totalBounties) * 100 },
    { label: 'Completed', count: completed, color: 'bg-emerald-500', pct: (completed / stats.totalBounties) * 100 },
    { label: 'Other', count: other, color: 'bg-slate-600', pct: (other / stats.totalBounties) * 100 },
  ];

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/60 p-5 backdrop-blur-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">Bounty Status Breakdown</h2>
      {/* Stacked progress bar */}
      <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-slate-700">
        {bars.map((b) => (
          <div
            key={b.label}
            className={clsx('transition-all duration-500', b.color)}
            style={{ width: `${b.pct}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-4">
        {bars.map((b) => (
          <div key={b.label} className="flex items-center gap-2 text-sm">
            <span className={clsx('h-2.5 w-2.5 rounded-full', b.color)} />
            <span className="text-slate-400">{b.label}</span>
            <span className="font-semibold text-white">{b.count.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const [autoRefresh, setAutoRefresh] = useState(false);
  const refreshInterval = parseInt(process.env.NEXT_PUBLIC_REFRESH_INTERVAL ?? '30000', 10);

  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: dashboard.getStats,
    refetchInterval: autoRefresh ? refreshInterval : false,
    staleTime: 10_000,
  });

  const { data: activity, isLoading: activityLoading } = useQuery({
    queryKey: ['dashboard-activity'],
    queryFn: () => dashboard.getActivity(25),
    refetchInterval: autoRefresh ? refreshInterval : false,
    staleTime: 10_000,
  });

  const lastRefreshed = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : '—';

  return (
    <div className="min-h-screen bg-slate-900 p-6 text-white">
      {/* Page header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard Overview</h1>
          <p className="mt-1 text-sm text-slate-400">Last refreshed: {lastRefreshed}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Auto-refresh toggle */}
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-400">
            <span>Auto-refresh</span>
            <button
              role="switch"
              aria-checked={autoRefresh}
              onClick={() => setAutoRefresh((v) => !v)}
              className={clsx(
                'relative h-5 w-9 rounded-full transition-colors',
                autoRefresh ? 'bg-violet-500' : 'bg-slate-600',
              )}
            >
              <span
                className={clsx(
                  'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                  autoRefresh ? 'translate-x-4' : 'translate-x-0.5',
                )}
              />
            </button>
          </label>
          <button
            onClick={() => refetchStats()}
            className="flex items-center gap-1.5 rounded-lg bg-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-600 active:scale-95 transition-all"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Bounties"
          value={stats?.totalBounties ?? 0}
          subtitle={`${stats?.openBounties ?? 0} open`}
          trend="up"
          trendValue="+12%"
          icon={<Award className="h-5 w-5" />}
          loading={statsLoading}
        />
        <StatsCard
          title="Active Contributors"
          value={stats?.activeContributors ?? 0}
          subtitle={`${stats?.totalContributors ?? 0} total registered`}
          trend="up"
          trendValue="+5%"
          icon={<Users className="h-5 w-5" />}
          loading={statsLoading}
        />
        <StatsCard
          title="Treasury Balance"
          value={stats ? `${(stats.treasury.balance / 1_000_000).toFixed(2)}M` : '—'}
          subtitle="$FNDRY tokens"
          trend="neutral"
          icon={<Wallet className="h-5 w-5" />}
          loading={statsLoading}
        />
        <StatsCard
          title="Total Paid Out"
          value={stats ? `${(stats.treasury.totalPaidOut / 1_000_000).toFixed(2)}M` : '—'}
          subtitle="$FNDRY lifetime"
          trend="up"
          trendValue="+8%"
          icon={<TrendingUp className="h-5 w-5" />}
          loading={statsLoading}
        />
      </div>

      {/* Middle row: breakdown + quick actions */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        {stats && <StatusBreakdown stats={stats} />}
        <QuickActions />
      </div>

      {/* Activity feed */}
      <div className="rounded-xl border border-slate-700/60 bg-slate-800/60 p-5 backdrop-blur-sm">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-slate-400">Recent Activity</h2>
        <p className="mb-4 text-xs text-slate-500">Latest platform events — last 25 entries</p>
        {activityLoading ? (
          <ul className="divide-y divide-slate-700/40">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="flex items-start gap-3 py-3">
                <div className="mt-0.5 h-7 w-7 animate-pulse rounded-full bg-slate-700" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-3/4 animate-pulse rounded bg-slate-700" />
                  <div className="h-3 w-1/3 animate-pulse rounded bg-slate-700" />
                </div>
              </li>
            ))}
          </ul>
        ) : activity && activity.length > 0 ? (
          <ul className="divide-y divide-slate-700/40">
            {activity.map((event) => (
              <ActivityItem key={event.id} event={event} />
            ))}
          </ul>
        ) : (
          <p className="py-8 text-center text-sm text-slate-500">No recent activity</p>
        )}
      </div>
    </div>
  );
}
