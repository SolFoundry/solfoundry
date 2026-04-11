'use client';

import React, { useState, useEffect, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface GithubActivity {
  date: string; // ISO date
  commits: number;
  prs: number;
  issues: number;
}

export interface EarningData {
  week: string; // e.g. "Week 12"
  amount: number;
}

export interface ContributorProfileProps {
  username: string;
  avatarUrl?: string;
  walletAddress?: string;
  totalEarned?: number;
  bountiesCompleted?: number;
  reputationScore?: number;
  /** GitHub activity for the last N weeks */
  githubActivity?: GithubActivity[];
  /** Weekly earning history */
  earningHistory?: EarningData[];
  /** GitHub handle — used to fetch real data if provided */
  githubHandle?: string;
}

interface GithubStats {
  totalCommits: number;
  totalPRs: number;
  totalIssues: number;
  currentStreak: number;
  longestStreak: number;
  topLanguage?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_ACTIVITY: GithubActivity[] = [
  { date: '2026-03-09', commits: 4, prs: 1, issues: 0 },
  { date: '2026-03-16', commits: 7, prs: 2, issues: 1 },
  { date: '2026-03-23', commits: 3, prs: 0, issues: 2 },
  { date: '2026-03-30', commits: 9, prs: 1, issues: 0 },
  { date: '2026-04-06', commits: 5, prs: 3, issues: 1 },
  { date: '2026-04-12', commits: 6, prs: 1, issues: 0 },
];

const DEFAULT_EARNINGS: EarningData[] = [
  { week: 'W9', amount: 0 },
  { week: 'W10', amount: 100000 },
  { week: 'W11', amount: 50000 },
  { week: 'W12', amount: 200000 },
  { week: 'W13', amount: 150000 },
  { week: 'W14', amount: 300000 },
];

const MAX_BAR_HEIGHT = 80; // px

// ============================================================================
// Chart Components
// ============================================================================

/**
 * GitHub Activity Bar Chart
 * Shows commits + PRs + issues per week as stacked bars
 */
const ActivityChart: React.FC<{ data: GithubActivity[] }> = ({ data }) => {
  const maxVal = Math.max(...data.map((d) => d.commits + d.prs + d.issues), 1);

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-white font-semibold text-sm mb-3">GitHub Activity (Last 6 Weeks)</h3>
      <div className="flex items-end gap-1 h-24">
        {data.map((week, i) => {
          const total = week.commits + week.prs + week.issues;
          const commitH = Math.round((week.commits / maxVal) * MAX_BAR_HEIGHT);
          const prH = Math.round((week.prs / maxVal) * MAX_BAR_HEIGHT);
          const issueH = Math.round((week.issues / maxVal) * MAX_BAR_HEIGHT);
          const label = week.date.slice(5); // MM-DD

          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group">
              <div className="w-full flex flex-col-reverse items-center" style={{ height: MAX_BAR_HEIGHT }}>
                {commitH > 0 && (
                  <div className="w-full max-w-[20px] bg-green-500/80 rounded-t" style={{ height: commitH }} title={`${week.commits} commits`} />
                )}
                {prH > 0 && (
                  <div className="w-full max-w-[20px] bg-purple-500/80" style={{ height: prH }} title={`${week.prs} PRs`} />
                )}
                {issueH > 0 && (
                  <div className="w-full max-w-[20px] bg-blue-500/80 rounded-b" style={{ height: issueH }} title={`${week.issues} issues`} />
                )}
              </div>
              <span className="text-gray-500 text-[9px] mt-1">{label}</span>
              {/* Hover tooltip */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 border border-gray-600 rounded px-2 py-1 text-[10px] text-white absolute z-10 whitespace-nowrap pointer-events-none">
                {week.commits}C / {week.prs}P / {week.issues}I
              </div>
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 justify-center">
        {[['bg-green-500', 'Commits'], ['bg-purple-500', 'PRs'], ['bg-blue-500', 'Issues']].map(([c, l]) => (
          <div key={l} className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-sm ${c}`} />
            <span className="text-gray-400 text-[10px]">{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Earning History Line Chart
 * Shows FNDRY earned per week as a line + area chart
 */
const EarningsChart: React.FC<{ data: EarningData[]; maxEarned: number }> = ({ data, maxEarned }) => {
  const height = 100;
  const width = 100; // percentage-based
  const padX = 8; // %
  const padY = 10; // px
  const chartW = 100 - padX * 2;
  const chartH = height - padY * 2;

  if (maxEarned === 0) return null;

  const points = data.map((d, i) => ({
    x: padX + (i / Math.max(data.length - 1, 1)) * chartW,
    y: padY + chartH - (d.amount / maxEarned) * chartH,
    week: d.week,
    amount: d.amount,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padY + chartH} L ${points[0].x} ${padY + chartH} Z`;

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-white font-semibold text-sm mb-3">FNDRY Earnings History</h3>
      <div className="relative" style={{ height }}>
        <svg viewBox={`0 0 100 ${height}`} className="w-full" preserveAspectRatio="none">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <line
              key={t}
              x1={padX} y1={padY + chartH * (1 - t)}
              x2={100 - padX} y2={padY + chartH * (1 - t)}
              stroke="#374151" strokeWidth="0.3"
            />
          ))}
          {/* Area fill */}
          <path d={areaPath} fill="url(#earningsGradient)" opacity="0.3" />
          {/* Line */}
          <path d={linePath} fill="none" stroke="#a855f7" strokeWidth="1" strokeLinejoin="round" />
          {/* Dots */}
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="1.5" fill="#a855f7" />
          ))}
          <defs>
            <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
        {/* Week labels */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-[8%]">
          {points.map((p, i) => (
            <span key={i} className="text-gray-500 text-[9px]">{p.week}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Streak indicator with flame icon
 */
const StreakBadge: React.FC<{ streak: number }> = ({ streak }) => (
  <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-3">
    <span className="text-2xl">{streak >= 7 ? '🔥' : streak >= 3 ? '⚡' : '🌱'}</span>
    <div>
      <p className="text-white font-bold text-lg leading-none">{streak}</p>
      <p className="text-gray-400 text-xs">day streak</p>
    </div>
  </div>
);

// ============================================================================
// Stats Grid
// ============================================================================

const StatsGrid: React.FC<{
  totalEarned: number;
  bountiesCompleted: number;
  reputationScore: number;
  ghStats: GithubStats;
}> = ({ totalEarned, bountiesCompleted, reputationScore, ghStats }) => (
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
    <div className="bg-gray-800 rounded-lg p-3 text-center">
      <p className="text-gray-400 text-xs mb-1">Total Earned</p>
      <p className="text-green-400 font-bold text-sm">
        {totalEarned >= 1000 ? `${(totalEarned / 1000).toFixed(0)}K` : totalEarned.toLocaleString()}
      </p>
      <p className="text-gray-500 text-[10px]">FNDRY</p>
    </div>
    <div className="bg-gray-800 rounded-lg p-3 text-center">
      <p className="text-gray-400 text-xs mb-1">Bounties</p>
      <p className="text-purple-400 font-bold text-sm">{bountiesCompleted}</p>
      <p className="text-gray-500 text-[10px]">completed</p>
    </div>
    <div className="bg-gray-800 rounded-lg p-3 text-center">
      <p className="text-gray-400 text-xs mb-1">Reputation</p>
      <p className="text-yellow-400 font-bold text-sm">{reputationScore}</p>
      <p className="text-gray-500 text-[10px]">pts</p>
    </div>
    <div className="bg-gray-800 rounded-lg p-3 text-center">
      <p className="text-gray-400 text-xs mb-1">Commits</p>
      <p className="text-blue-400 font-bold text-sm">{ghStats.totalCommits}</p>
      <p className="text-gray-500 text-[10px]">this cycle</p>
    </div>
  </div>
);

// ============================================================================
// GitHub API Fetcher
// ============================================================================

const fetchGithubStats = async (handle: string): Promise<GithubStats | null> => {
  try {
    const eventsRes = await fetch(`https://api.github.com/users/${handle}/events?per_page=100`, {
      headers: { Accept: 'application/vnd.github.v3+json' },
    });
    if (!eventsRes.ok) return null;
    const events = await eventsRes.json();

    let commits = 0, prs = 0, issues = 0;
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    for (const e of events) {
      const d = new Date(e.created_at);
      if (d < thirtyDaysAgo) continue;
      if (e.type === 'PushEvent') commits += (e.payload?.commits?.length || 0);
      if (e.type === 'PullRequestEvent' && e.payload?.action === 'opened') prs++;
      if (e.type === 'IssuesEvent' && e.payload?.action === 'opened') issues++;
    }

    return { totalCommits: commits, totalPRs: prs, totalIssues: issues, currentStreak: 0, longestStreak: 0 };
  } catch {
    return null;
  }
};

// ============================================================================
// Main Component
// ============================================================================

export const ContributorProfile: React.FC<ContributorProfileProps> = ({
  username,
  avatarUrl,
  walletAddress = '',
  totalEarned = 0,
  bountiesCompleted = 0,
  reputationScore = 0,
  githubActivity = DEFAULT_ACTIVITY,
  earningHistory = DEFAULT_EARNINGS,
  githubHandle,
}) => {
  const [ghStats, setGhStats] = useState<GithubStats>({
    totalCommits: githubActivity.reduce((s, w) => s + w.commits, 0),
    totalPRs: githubActivity.reduce((s, w) => s + w.prs, 0),
    totalIssues: githubActivity.reduce((s, w) => s + w.issues, 0),
    currentStreak: 4,
    longestStreak: 12,
  });
  const [loadingGh, setLoadingGh] = useState(false);

  useEffect(() => {
    if (!githubHandle) return;
    setLoadingGh(true);
    fetchGithubStats(githubHandle).then((stats) => {
      if (stats) setGhStats(stats);
      setLoadingGh(false);
    });
  }, [githubHandle]);

  const truncatedWallet = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : 'Not connected';

  const maxEarning = Math.max(...earningHistory.map((e) => e.amount), 1);

  return (
    <div className="bg-gray-900 rounded-lg p-4 sm:p-6 text-white space-y-4">
      {/* Profile Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-purple-500 flex items-center justify-center shrink-0 mx-auto sm:mx-0 overflow-hidden">
          {avatarUrl ? (
            <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl sm:text-3xl font-bold">{username.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="text-center sm:text-left flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold">{username}</h1>
            {githubHandle && (
              <a
                href={`https://github.com/${githubHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white text-sm transition-colors"
              >
                @{githubHandle}
              </a>
            )}
          </div>
          <p className="text-gray-400 text-xs font-mono mt-1">{truncatedWallet}</p>
        </div>
        <div className="flex gap-2 justify-center sm:justify-end">
          <StreakBadge streak={ghStats.currentStreak} />
        </div>
      </div>

      {/* Stats Grid */}
      <StatsGrid
        totalEarned={totalEarned}
        bountiesCompleted={bountiesCompleted}
        reputationScore={reputationScore}
        ghStats={ghStats}
      />

      {/* Charts Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ActivityChart data={githubActivity} />
        <EarningsChart data={earningHistory} maxEarned={maxEarning} />
      </div>

      {/* Additional GitHub Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-800 rounded-lg p-3 text-center">
          <p className="text-green-400 font-bold">{ghStats.totalCommits}</p>
          <p className="text-gray-500 text-[10px]">commits</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-3 text-center">
          <p className="text-purple-400 font-bold">{ghStats.totalPRs}</p>
          <p className="text-gray-500 text-[10px]">PRs</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-3 text-center">
          <p className="text-blue-400 font-bold">{ghStats.totalIssues}</p>
          <p className="text-gray-500 text-[10px]">issues</p>
        </div>
      </div>

      {/* Hire as Agent Button */}
      <button
        className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 sm:py-4 rounded-lg font-medium transition-colors disabled:opacity-50 min-h-[44px] touch-manipulation"
        disabled
      >
        Hire as Agent (Coming Soon)
      </button>
    </div>
  );
};

export default ContributorProfile;
