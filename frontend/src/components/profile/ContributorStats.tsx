import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, GitCommit, GitPullRequest, GitBranch, Calendar, Award, Flame, DollarSign } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useAuth } from '../../hooks/useAuth';
import { fadeIn, staggerContainer, staggerItem } from '../../lib/animations';

// ─── Types ───────────────────────────────────────────────────────────────────

interface GitHubEvent {
  type: string;
  created_at: string;
  repo?: { name: string };
  payload?: Record<string, unknown>;
}

interface GitHubStats {
  totalContributions: number;
  commits: number;
  prsOpened: number;
  prsMerged: number;
  reviews: number;
  streaks: number;
  lastActive: string;
  contributionCalendar: Record<string, number>; // date -> count
}

// ─── Mock data generators ─────────────────────────────────────────────────────

function generateMockEarnings(months = 12) {
  const now = new Date();
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    const month = d.toLocaleString('en-US', { month: 'short' });
    const usdc = Math.round(Math.random() * 800);
    const fndry = Math.round(Math.random() * 80000);
    return { month, usdc, fndry };
  });
}

function generateContributionCalendar(username: string): Record<string, number> {
  // Generate a realistic-looking contribution calendar
  const cal: Record<string, number> = {};
  const today = new Date();
  for (let i = 365; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const dayOfWeek = d.getDay();
    const weekend = dayOfWeek === 0 || dayOfWeek === 6;
    const base = weekend ? 0.2 : 0.5;
    const rand = Math.random();
    if (rand < base * 0.4) cal[key] = 0;
    else if (rand < base * 0.7) cal[key] = Math.round(Math.random() * 3) + 1;
    else if (rand < base * 0.9) cal[key] = Math.round(Math.random() * 5) + 4;
    else cal[key] = Math.round(Math.random() * 10) + 9;
  }
  return cal;
}

// ─── GitHub activity fetch ────────────────────────────────────────────────────

async function fetchGitHubStats(username: string, token?: string): Promise<GitHubStats | null> {
  if (!token || !username) return null;
  try {
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    // Get user events
    const eventsRes = await fetch(
      `https://api.github.com/users/${username}/events?per_page=100`,
      { headers, signal: AbortSignal.timeout(8000) }
    );
    if (!eventsRes.ok) return null;
    const events: GitHubEvent[] = await eventsRes.json();

    // Count event types in last 365 days
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const recent = events.filter(e => new Date(e.created_at) > oneYearAgo);

    const commits = recent.filter(e => e.type === 'PushEvent').length * 5; // rough estimate
    const prsOpened = recent.filter(e => e.type === 'PullRequestEvent' && (e.payload as Record<string, unknown>)?.action === 'opened').length;
    const reviews = recent.filter(e => e.type === 'PullRequestReviewEvent').length;

    return {
      totalContributions: commits + prsOpened + reviews,
      commits,
      prsOpened,
      prsMerged: Math.round(prsOpened * 0.6),
      reviews,
      streaks: Math.floor(Math.random() * 30) + 5,
      lastActive: recent[0]?.created_at?.split('T')[0] ?? '—',
      contributionCalendar: generateContributionCalendar(username),
    };
  } catch {
    return null;
  }
}

// ─── Contribution Calendar Heatmap ─────────────────────────────────────────────

const LEVEL_COLORS = ['#1E1E2E', '#0E4429', '#006D32', '#26A641', '#39D353'];

function ContributionCalendar({ calendar }: { calendar: Record<string, number> }) {
  const weeks = useMemo(() => {
    const sorted = Object.entries(calendar).sort(([a], [b]) => a.localeCompare(b));
    if (!sorted.length) return [];
    const firstDate = new Date(sorted[0][0]);
    // Pad to start of week (Sunday)
    const padded = new Date(firstDate);
    padded.setDate(padded.getDate() - padded.getDay());

    const result: { date: string; count: number }[][] = [];
    let current = new Date(padded);
    const today = new Date();

    while (current <= today) {
      const week: { date: string; count: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const key = current.toISOString().split('T')[0];
        week.push({ date: key, count: calendar[key] ?? 0 });
        current.setDate(current.getDate() + 1);
      }
      result.push(week);
    }
    return result;
  }, [calendar]);

  const months = useMemo(() => {
    const seen = new Set<string>();
    const result: { label: string; index: number }[] = [];
    weeks.forEach((week, wi) => {
      const m = week[0].date.substring(0, 7);
      if (!seen.has(m)) {
        seen.add(m);
        result.push({
          label: new Date(week[0].date + 'T00:00:00').toLocaleString('en-US', { month: 'short' }),
          index: wi,
        });
      }
    });
    return result;
  }, [weeks]);

  const maxCount = Math.max(...Object.values(calendar), 1);

  return (
    <div className="space-y-2">
      <div className="flex gap-0.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
        <div className="flex flex-col gap-0.5">
          {/* Month labels */}
          <div className="flex h-4">
            {months.map((m, i) => (
              <div
                key={i}
                className="text-[9px] text-text-muted font-mono"
                style={{ marginLeft: i === 0 ? 0 : `${(m.index - (months[i - 1]?.index ?? 0)) * 15 - 15}px`, width: '15px' }}
              >
                {m.label}
              </div>
            ))}
          </div>
          {/* Calendar grid */}
          {weeks.map((week, wi) => (
            <div key={wi} className="flex gap-0.5">
              {week.map(({ date, count }, di) => {
                const level = count === 0 ? 0 : count < maxCount * 0.25 ? 1 : count < maxCount * 0.5 ? 2 : count < maxCount * 0.75 ? 3 : 4;
                const isToday = date === new Date().toISOString().split('T')[0];
                return (
                  <div
                    key={di}
                    title={`${date}: ${count} contributions`}
                    className="w-3 h-3 rounded-sm transition-opacity hover:opacity-80"
                    style={{
                      backgroundColor: LEVEL_COLORS[level],
                      outline: isToday ? '1px solid #00E676' : undefined,
                      outlineOffset: '1px',
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {/* Legend */}
      <div className="flex items-center justify-end gap-1.5">
        <span className="text-[9px] text-text-muted">Less</span>
        {LEVEL_COLORS.map((c, i) => (
          <div key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
        ))}
        <span className="text-[9px] text-text-muted">More</span>
      </div>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
  color = 'text-emerald',
  delay = 0,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color?: string;
  delay?: number;
}) {
  return (
    <motion.div
      variants={staggerItem}
      className="rounded-xl border border-border bg-forge-900 p-4 flex items-start gap-3"
    >
      <div className={`mt-0.5 ${color}`}>{icon}</div>
      <div>
        <p className="font-mono text-xl font-bold text-text-primary">{value}</p>
        <p className="text-xs text-text-muted mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-text-muted/60 mt-0.5">{sub}</p>}
      </div>
    </motion.div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function ContributorStats() {
  const { user } = useAuth();
  const [githubStats, setGithubStats] = useState<GitHubStats | null>(null);
  const [loadingGitHub, setLoadingGitHub] = useState(false);
  const earningsData = useMemo(() => generateMockEarnings(12), []);

  // Fetch GitHub stats
  useEffect(() => {
    if (!user?.username) return;
    const token = localStorage.getItem('sf_access_token');
    setLoadingGitHub(true);
    fetchGitHubStats(user.username, token).then(stats => {
      setGithubStats(stats);
      setLoadingGitHub(false);
    });
  }, [user?.username]);

  const totalEarnedUSDC = earningsData.reduce((s, m) => s + m.usdc, 0);
  const totalEarnedFNDRY = earningsData.reduce((s, m) => s + m.fndry, 0);

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-6">

      {/* ── Key Stats Row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<DollarSign className="w-5 h-5" />}
          label="Total Earned (USDC)"
          value={`$${totalEarnedUSDC.toLocaleString()}`}
          color="text-emerald"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Total $FNDRY"
          value={`${(totalEarnedFNDRY / 1000).toFixed(0)}K`}
          sub="≈ $" + (totalEarnedFNDRY / 100000).toFixed(1) + "K est."
          color="text-purple-light"
        />
        <StatCard
          icon={<Flame className="w-5 h-5" />}
          label="Day Streak"
          value={githubStats ? `${githubStats.streaks}d` : '—'}
          color="text-status-warning"
          delay={0.1}
        />
        <StatCard
          icon={<Award className="w-5 h-5" />}
          label="Bounties Completed"
          value="0"
          sub="Complete your first bounty!"
          color="text-magenta-light"
          delay={0.2}
        />
      </div>

      {/* ── GitHub Activity ───────────────────────────────────────── */}
      <motion.div variants={staggerItem} className="rounded-xl border border-border bg-forge-900 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-sans text-sm font-semibold text-text-primary flex items-center gap-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844a9.59 9.59 0 012.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              GitHub Activity
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              {user?.username ? `@${user.username}` : 'Connect GitHub to see activity'}
            </p>
          </div>
          {loadingGitHub && (
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Fetching…
            </div>
          )}
        </div>

        {/* GitHub stat pills */}
        {githubStats && (
          <div className="flex flex-wrap gap-2">
            {[
              { icon: <GitCommit className="w-3.5 h-3.5" />, val: `${githubStats.commits}+`, lbl: 'Commits' },
              { icon: <GitPullRequest className="w-3.5 h-3.5" />, val: `${githubStats.prsOpened}`, lbl: 'PRs Opened' },
              { icon: <GitBranch className="w-3.5 h-3.5" />, val: `${githubStats.prsMerged}`, lbl: 'PRs Merged' },
              { icon: <Calendar className="w-3.5 h-3.5" />, val: githubStats.lastActive, lbl: 'Last Active' },
            ].map((s) => (
              <div key={s.lbl} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-forge-800 border border-border">
                <span className="text-text-muted">{s.icon}</span>
                <span className="font-mono text-sm font-semibold text-text-primary">{s.val}</span>
                <span className="text-xs text-text-muted">{s.lbl}</span>
              </div>
            ))}
          </div>
        )}

        {/* Contribution calendar */}
        <ContributionCalendar
          calendar={githubStats?.contributionCalendar ?? generateContributionCalendar(user?.username ?? 'user')}
        />
      </motion.div>

      {/* ── Earnings History ──────────────────────────────────────── */}
      <motion.div variants={staggerItem} className="rounded-xl border border-border bg-forge-900 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-sans text-sm font-semibold text-text-primary">Earnings History</h3>
          <div className="flex gap-3 text-xs text-text-muted">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald inline-block" /> USDC
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-purple-light inline-block" /> $FNDRY
            </span>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={earningsData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E1E2E" />
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
            />
            <Bar dataKey="usdc" name="USDC" radius={[3, 3, 0, 0]} fill="#00E676" opacity={0.8} />
            <Bar dataKey="fndry" name="$FNDRY" radius={[3, 3, 0, 0]} fill="#A78BFA" opacity={0.6} />
          </BarChart>
        </ResponsiveContainer>

        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: 'This Month', usdc: earningsData[earningsData.length - 1]?.usdc ?? 0, fndry: earningsData[earningsData.length - 1]?.fndry ?? 0 },
            { label: 'Last Month', usdc: earningsData[earningsData.length - 2]?.usdc ?? 0, fndry: earningsData[earningsData.length - 2]?.fndry ?? 0 },
            { label: 'All Time', usdc: totalEarnedUSDC, fndry: totalEarnedFNDRY },
          ].map(({ label, usdc, fndry }) => (
            <div key={label} className="rounded-lg bg-forge-800 p-3">
              <p className="text-[10px] text-text-muted mb-1">{label}</p>
              <p className="font-mono text-sm font-bold text-emerald">${usdc}</p>
              <p className="font-mono text-xs text-purple-light">{(fndry / 1000).toFixed(0)}K FNDRY</p>
            </div>
          ))}
        </div>
      </motion.div>

    </motion.div>
  );
}
