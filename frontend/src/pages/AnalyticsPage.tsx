import React, { useMemo, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, TrendingDown, DollarSign, Users, FileText, Download,
  BarChart3, PieChart, Activity, Calendar, Award, Target,
  ArrowUpRight, ArrowDownRight, ChevronDown, Filter,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart as RePieChart, Pie, Cell,
  Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';
import { motion } from 'framer-motion';
import { PageLayout } from '../components/layout/PageLayout';
import { listBounties } from '../api/bounties';
import { getPlatformStats } from '../api/stats';
import { getLeaderboard } from '../api/leaderboard';
import type { Bounty } from '../types/bounty';

/* ------------------------------------------------------------------ */
/*  Colour palette matching the Forge theme                           */
/* ------------------------------------------------------------------ */
const COLORS = {
  emerald: '#00E676',
  emeraldLight: '#69F0AE',
  purple: '#7C3AED',
  purpleLight: '#A78BFA',
  magenta: '#E040FB',
  magentaLight: '#EA80FC',
  cyan: '#40C4FF',
  orange: '#FFB300',
  red: '#FF5252',
  teal: '#1DE9B6',
  surface: '#1E1E2E',
  textMuted: '#5C5C78',
  textSecondary: '#A0A0B8',
  textPrimary: '#F0F0F5',
  bg: '#0A0A0F',
};

const CHART_COLORS = [COLORS.emerald, COLORS.purple, COLORS.magenta, COLORS.cyan, COLORS.orange, COLORS.teal, COLORS.red];

/* ------------------------------------------------------------------ */
/*  Custom tooltip component                                          */
/* ------------------------------------------------------------------ */
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-forge-900 border border-border rounded-xl px-4 py-3 shadow-2xl shadow-black/50">
      <p className="text-xs text-text-muted font-mono mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm font-medium" style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
        </p>
      ))}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Stat card                                                          */
/* ------------------------------------------------------------------ */
interface StatCardProps {
  title: string;
  value: string | number;
  change?: { value: number; isPositive: boolean };
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
  delay?: number;
}

function StatCard({ title, value, change, icon, color, subtitle, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="group relative rounded-2xl border border-border bg-forge-900/60 backdrop-blur-sm p-5 overflow-hidden"
    >
      {/* Subtle gradient overlay */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `linear-gradient(135deg, ${color}08 0%, transparent 60%)`,
        }}
      />
      <div className="relative flex items-start justify-between">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold font-display text-text-primary">{value}</p>
          {subtitle && <p className="text-xs text-text-muted">{subtitle}</p>}
          {change && (
            <div className={`inline-flex items-center gap-1 text-xs font-medium mt-1 ${
              change.isPositive ? 'text-status-success' : 'text-status-error'
            }`}>
              {change.isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {change.value}%
            </div>
          )}
        </div>
        <div
          className="p-2.5 rounded-xl"
          style={{ backgroundColor: `${color}15`, color }}
        >
          {icon}
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section header                                                    */
/* ------------------------------------------------------------------ */
function SectionHeader({ icon, title, subtitle, action }: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-forge-800 text-text-secondary">
          {icon}
        </div>
        <div>
          <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
          {subtitle && <p className="text-sm text-text-muted">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CSV Export utility                                                */
/* ------------------------------------------------------------------ */
function downloadCSV(data: Record<string, any>[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row =>
      headers.map(h => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        const str = String(val);
        // Escape commas and quotes
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(',')
    ),
  ];
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/*  Period selector                                                    */
/* ------------------------------------------------------------------ */
type Period = '7d' | '30d' | '90d' | 'all';

const PERIODS: { label: string; value: Period }[] = [
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
  { label: 'All time', value: 'all' },
];

function PeriodSelector({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="flex items-center gap-1 bg-forge-800 rounded-lg p-1 border border-border">
      {PERIODS.map(p => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-150 ${
            value === p.value
              ? 'bg-forge-700 text-text-primary shadow-sm'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Analytics Page                                               */
/* ------------------------------------------------------------------ */
export function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('all');

  // Fetch data
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: getPlatformStats,
    staleTime: 60_000,
  });

  const { data: bountiesData, isLoading: bountiesLoading } = useQuery({
    queryKey: ['bounties', 'all'],
    queryFn: () => listBounties({ limit: 200 }),
    staleTime: 60_000,
  });

  const { data: leaderboard, isLoading: leaderboardLoading } = useQuery({
    queryKey: ['leaderboard', 'all'],
    queryFn: () => getLeaderboard('all'),
    staleTime: 60_000,
  });

  const isLoading = statsLoading || bountiesLoading || leaderboardLoading;

  // Process data
  const bounties = bountiesData?.items ?? [];

  const {
    bountyVolumeData,
    statusDistribution,
    tierDistribution,
    tokenDistribution,
    avgRewardByTier,
    topSkills,
    dailySubmissions,
    filteredBounties,
    newBountiesCount,
    completedBountiesCount,
  } = useMemo(() => {
    const now = Date.now();
    const periodMs = period === '7d' ? 7 * 86400_000
      : period === '30d' ? 30 * 86400_000
      : period === '90d' ? 90 * 86400_000
      : Infinity;

    const filtered = bounties.filter(b => {
      if (period === 'all') return true;
      const created = new Date(b.created_at).getTime();
      return now - created <= periodMs;
    });

    // --- Bounty Volume (by day/week) ---
    const volumeMap = new Map<string, { created: number; completed: number }>();
    filtered.forEach(b => {
      const date = new Date(b.created_at).toISOString().slice(0, 10);
      if (!volumeMap.has(date)) volumeMap.set(date, { created: 0, completed: 0 });
      volumeMap.get(date)!.created++;
      if (b.status === 'completed') {
        volumeMap.get(date)!.completed++;
      }
    });
    const volumeData = Array.from(volumeMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-60) // last 60 days
      .map(([date, counts]) => ({
        date,
        Created: counts.created,
        Completed: counts.completed,
      }));

    // --- Status Distribution ---
    const statusCounts = new Map<string, number>();
    filtered.forEach(b => {
      statusCounts.set(b.status, (statusCounts.get(b.status) || 0) + 1);
    });
    const statusData = Array.from(statusCounts.entries()).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1).replace('_', ' '),
      value,
    }));

    // --- Tier Distribution ---
    const tierCounts = new Map<string, number>();
    filtered.forEach(b => {
      tierCounts.set(b.tier, (tierCounts.get(b.tier) || 0) + 1);
    });
    const tierData = Array.from(tierCounts.entries()).map(([name, value]) => ({
      name,
      value,
    }));

    // --- Token Distribution ---
    const tokenCounts = new Map<string, number>();
    filtered.forEach(b => {
      tokenCounts.set(b.reward_token, (tokenCounts.get(b.reward_token) || 0) + 1);
    });
    const tokenData = Array.from(tokenCounts.entries()).map(([name, value]) => ({
      name,
      value,
    }));

    // --- Average Reward by Tier ---
    const tierRewards = new Map<string, { total: number; count: number }>();
    filtered.forEach(b => {
      if (!tierRewards.has(b.tier)) tierRewards.set(b.tier, { total: 0, count: 0 });
      const r = tierRewards.get(b.tier)!;
      r.total += b.reward_amount;
      r.count++;
    });
    const avgRewardData = Array.from(tierRewards.entries()).map(([tier, { total, count }]) => ({
      tier,
      avgReward: Math.round(total / count),
      count,
    }));

    // --- Top Skills ---
    const skillCounts = new Map<string, number>();
    filtered.forEach(b => {
      b.skills.forEach(s => {
        skillCounts.set(s, (skillCounts.get(s) || 0) + 1);
      });
    });
    const topSkillsData = Array.from(skillCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([skill, count]) => ({ skill, count }));

    // --- Daily Submissions ---
    const subMap = new Map<string, number>();
    filtered.forEach(b => {
      if (b.submission_count > 0) {
        const date = new Date(b.created_at).toISOString().slice(0, 10);
        subMap.set(date, (subMap.get(date) || 0) + b.submission_count);
      }
    });
    const subData = Array.from(subMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-60)
      .map(([date, count]) => ({ date, Submissions: count }));

    // --- Counts ---
    const newCount = filtered.length;
    const completedCount = filtered.filter(b => b.status === 'completed').length;

    return {
      bountyVolumeData: volumeData,
      statusDistribution: statusData,
      tierDistribution: tierData,
      tokenDistribution: tokenData,
      avgRewardByTier: avgRewardData,
      topSkills: topSkillsData,
      dailySubmissions: subData,
      filteredBounties: filtered,
      newBountiesCount: newCount,
      completedBountiesCount: completedCount,
    };
  }, [bounties, period]);

  // --- CSV Export handlers ---
  const handleExportBounties = useCallback(() => {
    downloadCSV(
      filteredBounties.map(b => ({
        ID: b.id,
        Title: b.title,
        Status: b.status,
        Tier: b.tier,
        Reward: b.reward_amount,
        Token: b.reward_token,
        Skills: b.skills.join('; '),
        Submissions: b.submission_count,
        Created: b.created_at?.slice(0, 10),
        Deadline: b.deadline?.slice(0, 10) ?? '',
      })),
      'solfoundry-bounties'
    );
  }, [filteredBounties]);

  const handleExportVolume = useCallback(() => {
    downloadCSV(bountyVolumeData, 'solfoundry-bounty-volume');
  }, [bountyVolumeData]);

  const handleExportLeaderboard = useCallback(() => {
    if (!leaderboard?.length) return;
    downloadCSV(
      leaderboard.map(e => ({
        Rank: e.rank,
        Username: e.username,
        Points: e.points,
        'Bounties Completed': e.bountiesCompleted,
        'Earnings (FNDRY)': e.earningsFndry,
        'Earnings (SOL)': e.earningsSol,
        Streak: e.streak ?? 0,
        Reputation: e.reputation,
        Skills: e.topSkills.join('; '),
      })),
      'solfoundry-contributors'
    );
  }, [leaderboard]);

  // --- Aggregate stats ---
  const totalRewards = filteredBounties.reduce((sum, b) => sum + b.reward_amount, 0);
  const prevPeriodBounties = useMemo(() => {
    if (period === 'all') return 0;
    const now = Date.now();
    const currentStart = period === '7d' ? 7 * 86400_000
      : period === '30d' ? 30 * 86400_000
      : 90 * 86400_000;
    const prevStart = currentStart * 2;
    return bounties.filter(b => {
      const created = new Date(b.created_at).getTime();
      return now - prevStart <= created && created < now - currentStart;
    }).length;
  }, [bounties, period]);

  const bountyChange = prevPeriodBounties > 0
    ? { value: Math.round(((newBountiesCount - prevPeriodBounties) / prevPeriodBounties) * 100), isPositive: newBountiesCount >= prevPeriodBounties }
    : undefined;

  if (isLoading) {
    return (
      <PageLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 rounded-full border-2 border-emerald border-t-transparent animate-spin" />
            <p className="text-sm text-text-muted font-mono">Loading analytics...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* ====== Header ====== */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl font-bold font-display text-text-primary flex items-center gap-3">
              <BarChart3 className="w-6 h-6 text-magenta" />
              Analytics Dashboard
            </h1>
            <p className="text-sm text-text-muted mt-1">
              Track bounty trends, payout distribution, contributor growth, and engagement metrics
            </p>
          </div>
          <div className="flex items-center gap-3">
            <PeriodSelector value={period} onChange={setPeriod} />
            <button
              onClick={handleExportBounties}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-forge-800 hover:bg-forge-700 text-text-secondary hover:text-text-primary text-xs font-medium transition-all duration-150"
              title="Export bounty data as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </motion.div>

        {/* ====== Summary Stats ====== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Open Bounties"
            value={stats?.open_bounties ?? 0}
            icon={<Target className="w-5 h-5" />}
            color={COLORS.emerald}
            change={bountyChange}
            subtitle={`${newBountiesCount} in period`}
            delay={0}
          />
          <StatCard
            title="Total Paid"
            value={`$${(stats?.total_paid_usdc ?? 0).toLocaleString()}`}
            icon={<DollarSign className="w-5 h-5" />}
            color={COLORS.purple}
            subtitle={`${totalRewards.toLocaleString()} FNDRY in rewards`}
            delay={0.05}
          />
          <StatCard
            title="Contributors"
            value={stats?.total_contributors ?? 0}
            icon={<Users className="w-5 h-5" />}
            color={COLORS.cyan}
            subtitle={`${leaderboard?.length ?? 0} on leaderboard`}
            delay={0.1}
          />
          <StatCard
            title="Total Bounties"
            value={stats?.total_bounties ?? 0}
            icon={<FileText className="w-5 h-5" />}
            color={COLORS.magenta}
            subtitle={`${completedBountiesCount} completed`}
            delay={0.15}
          />
        </div>

        {/* ====== Charts Row 1: Bounty Volume + Status Distribution ====== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Bounty Volume (Area Chart) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="lg:col-span-2 rounded-2xl border border-border bg-forge-900/40 backdrop-blur-sm p-6"
          >
            <SectionHeader
              icon={<Activity className="w-5 h-5" />}
              title="Bounty Volume"
              subtitle="Created vs completed over time"
              action={
                <button
                  onClick={handleExportVolume}
                  className="p-1.5 rounded-lg hover:bg-forge-800 text-text-muted hover:text-text-secondary transition-colors"
                  title="Export volume data"
                >
                  <Download className="w-4 h-4" />
                </button>
              }
            />
            {bountyVolumeData.length > 0 ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={bountyVolumeData}>
                    <defs>
                      <linearGradient id="volumeCreated" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={COLORS.emerald} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={COLORS.emerald} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="volumeCompleted" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={COLORS.magenta} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={COLORS.magenta} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.surface} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: COLORS.textMuted }}
                      tickLine={false}
                      axisLine={{ stroke: COLORS.surface }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: COLORS.textMuted }}
                      tickLine={false}
                      axisLine={{ stroke: COLORS.surface }}
                      allowDecimals={false}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="Created"
                      stroke={COLORS.emerald}
                      fill="url(#volumeCreated)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="Completed"
                      stroke={COLORS.magenta}
                      fill="url(#volumeCompleted)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-72 flex items-center justify-center text-text-muted text-sm">
                No data available for the selected period
              </div>
            )}
          </motion.div>

          {/* Status Distribution (Pie Chart) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            className="rounded-2xl border border-border bg-forge-900/40 backdrop-blur-sm p-6"
          >
            <SectionHeader
              icon={<PieChart className="w-5 h-5" />}
              title="Status Distribution"
            />
            {statusDistribution.length > 0 ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={statusDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {statusDistribution.map((entry, i) => (
                        <Cell key={entry.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(value) => (
                        <span className="text-xs text-text-secondary">{value}</span>
                      )}
                    />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-72 flex items-center justify-center text-text-muted text-sm">
                No data
              </div>
            )}
          </motion.div>
        </div>

        {/* ====== Charts Row 2: Tier Distribution + Avg Reward + Top Skills ====== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tier Distribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="rounded-2xl border border-border bg-forge-900/40 backdrop-blur-sm p-6"
          >
            <SectionHeader
              icon={<Award className="w-5 h-5" />}
              title="By Tier"
            />
            {tierDistribution.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tierDistribution} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.surface} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: COLORS.textMuted }} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: COLORS.textSecondary }} tickLine={false} axisLine={false} width={30} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {tierDistribution.map((entry, i) => (
                        <Cell key={entry.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-text-muted text-sm">No data</div>
            )}
          </motion.div>

          {/* Average Reward by Tier */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.25 }}
            className="rounded-2xl border border-border bg-forge-900/40 backdrop-blur-sm p-6"
          >
            <SectionHeader
              icon={<DollarSign className="w-5 h-5" />}
              title="Avg Reward by Tier"
            />
            {avgRewardByTier.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={avgRewardByTier}>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.surface} />
                    <XAxis dataKey="tier" tick={{ fontSize: 11, fill: COLORS.textSecondary }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: COLORS.textMuted }} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="avgReward" radius={[4, 4, 0, 0]}>
                      {avgRewardByTier.map((entry, i) => (
                        <Cell key={entry.tier} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-text-muted text-sm">No data</div>
            )}
          </motion.div>

          {/* Top Skills */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            className="rounded-2xl border border-border bg-forge-900/40 backdrop-blur-sm p-6"
          >
            <SectionHeader
              icon={<Filter className="w-5 h-5" />}
              title="Top Skills"
            />
            {topSkills.length > 0 ? (
              <div className="h-64 space-y-2 overflow-y-auto pr-1">
                {topSkills.map((s, i) => {
                  const maxCount = topSkills[0].count;
                  const pct = (s.count / maxCount) * 100;
                  return (
                    <div key={s.skill} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-text-secondary truncate">{s.skill}</span>
                        <span className="text-text-muted font-mono text-xs">{s.count}</span>
                      </div>
                      <div className="w-full h-1.5 bg-forge-800 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.5, delay: 0.3 + i * 0.05 }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-text-muted text-sm">No data</div>
            )}
          </motion.div>
        </div>

        {/* ====== Charts Row 3: Daily Submissions + Token Distribution + Leaderboard ====== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Daily Submissions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.35 }}
            className="lg:col-span-2 rounded-2xl border border-border bg-forge-900/40 backdrop-blur-sm p-6"
          >
            <SectionHeader
              icon={<TrendingUp className="w-5 h-5" />}
              title="Daily Submissions"
              subtitle="Submission activity over time"
            />
            {dailySubmissions.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailySubmissions}>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.surface} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: COLORS.textMuted }}
                      tickLine={false}
                      axisLine={{ stroke: COLORS.surface }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: COLORS.textMuted }}
                      tickLine={false}
                      axisLine={{ stroke: COLORS.surface }}
                      allowDecimals={false}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="Submissions"
                      stroke={COLORS.cyan}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: COLORS.cyan }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-text-muted text-sm">No submission data</div>
            )}
          </motion.div>

          {/* Token Distribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.4 }}
            className="rounded-2xl border border-border bg-forge-900/40 backdrop-blur-sm p-6"
          >
            <SectionHeader
              icon={<PieChart className="w-5 h-5" />}
              title="Token Distribution"
            />
            {tokenDistribution.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={tokenDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {tokenDistribution.map((entry, i) => (
                        <Cell key={entry.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <Legend
                      verticalAlign="bottom"
                      height={30}
                      formatter={(value) => (
                        <span className="text-xs text-text-secondary">{value}</span>
                      )}
                    />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-text-muted text-sm">No data</div>
            )}
          </motion.div>
        </div>

        {/* ====== Export Section ====== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.45 }}
          className="rounded-2xl border border-border bg-forge-900/40 backdrop-blur-sm p-6"
        >
          <SectionHeader
            icon={<Download className="w-5 h-5" />}
            title="Export Reports"
            subtitle="Download analytics data as CSV files"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              onClick={handleExportBounties}
              className="flex items-center gap-3 p-4 rounded-xl border border-border bg-forge-800 hover:bg-forge-700 hover:border-border-hover transition-all duration-150 text-left group"
            >
              <div className="p-2 rounded-lg bg-emerald-bg text-emerald group-hover:scale-110 transition-transform">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">Bounty List</p>
                <p className="text-xs text-text-muted">{filteredBounties.length} bounties</p>
              </div>
            </button>
            <button
              onClick={handleExportVolume}
              className="flex items-center gap-3 p-4 rounded-xl border border-border bg-forge-800 hover:bg-forge-700 hover:border-border-hover transition-all duration-150 text-left group"
            >
              <div className="p-2 rounded-lg bg-purple-bg text-purple group-hover:scale-110 transition-transform">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">Volume Data</p>
                <p className="text-xs text-text-muted">{bountyVolumeData.length} data points</p>
              </div>
            </button>
            <button
              onClick={handleExportLeaderboard}
              className="flex items-center gap-3 p-4 rounded-xl border border-border bg-forge-800 hover:bg-forge-700 hover:border-border-hover transition-all duration-150 text-left group"
            >
              <div className="p-2 rounded-lg bg-magenta-bg text-magenta group-hover:scale-110 transition-transform">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">Contributors</p>
                <p className="text-xs text-text-muted">{leaderboard?.length ?? 0} contributors</p>
              </div>
            </button>
          </div>
        </motion.div>
      </div>
    </PageLayout>
  );
}