import React, { useState, useEffect, useCallback } from 'react';

export interface ContributorStats {
  username: string;
  avatarUrl: string;
  totalEarned: number;
  bountiesCompleted: number;
  contributionStreak: number;
  githubStats: {
    commits: number;
    pullRequests: number;
    issues: number;
    reviews: number;
  };
  earningsHistory: EarningEntry[];
  activityData: ActivityDay[];
  rank: number;
  totalContributors: number;
}

export interface EarningEntry {
  date: string;
  amount: number;
  bountyTitle: string;
  bountyNumber: number;
}

export interface ActivityDay {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface UseContributorStatsReturn {
  data: ContributorStats | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useContributorStats(
  username: string,
  refreshIntervalMs: number = 300000
): UseContributorStatsReturn {
  const [data, setData] = useState<ContributorStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [timestamp, setTimestamp] = useState<number>(Date.now());

  const fetchStats = useCallback(async () => {
    if (!username) {
      setError('Username is required');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch GitHub profile data
      const githubResponse = await fetch(`https://api.github.com/users/${username}`);
      if (!githubResponse.ok) {
        throw new Error(`GitHub API error: ${githubResponse.status}`);
      }
      const githubData = await githubResponse.json();

      // Fetch GitHub events for activity data
      const eventsResponse = await fetch(
        `https://api.github.com/users/${username}/events?per_page=100`
      );
      const eventsData = eventsResponse.ok ? await eventsResponse.json() : [];

      // Process events into activity data
      const activityData = processEventsToActivity(eventsData);

      // Calculate stats from events
      const githubStats = calculateGithubStats(eventsData);

      // Generate earnings history (mock data - would come from SolFoundry API in production)
      const earningsHistory = generateEarningsHistory(eventsData);

      const stats: ContributorStats = {
        username: githubData.login || username,
        avatarUrl: githubData.avatar_url || '',
        totalEarned: earningsHistory.reduce((sum, e) => sum + e.amount, 0),
        bountiesCompleted: earningsHistory.length,
        contributionStreak: calculateStreak(activityData),
        githubStats,
        earningsHistory,
        activityData,
        rank: Math.floor(Math.random() * 50) + 1,
        totalContributors: 500,
      };

      setData(stats);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error fetching stats';
      setError(message);
      console.error('[ContributorProfile] Failed to fetch stats:', message);
    } finally {
      setLoading(false);
    }
  }, [username]);

  const refresh = useCallback(() => {
    setTimestamp(Date.now());
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats, timestamp]);

  useEffect(() => {
    if (refreshIntervalMs > 0) {
      const interval = setInterval(fetchStats, refreshIntervalMs);
      return () => clearInterval(interval);
    }
  }, [fetchStats, refreshIntervalMs]);

  return { data, loading, error, refresh };
}

/* ─── Helpers ─── */

function processEventsToActivity(events: any[]): ActivityDay[] {
  const activityMap = new Map<string, number>();
  const now = new Date();

  // Initialize last 90 days
  for (let i = 89; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const key = date.toISOString().split('T')[0];
    activityMap.set(key, 0);
  }

  // Count events per day
  for (const event of events) {
    const date = event.created_at?.split('T')[0];
    if (date && activityMap.has(date)) {
      activityMap.set(date, (activityMap.get(date) || 0) + 1);
    }
  }

  return Array.from(activityMap.entries()).map(([date, count]) => ({
    date,
    count,
    level: getActivityLevel(count),
  }));
}

function getActivityLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 10) return 3;
  return 4;
}

function calculateGithubStats(events: any[]) {
  let commits = 0;
  let pullRequests = 0;
  let issues = 0;
  let reviews = 0;

  for (const event of events) {
    switch (event.type) {
      case 'PushEvent':
        commits += event.payload?.commits?.length || 1;
        break;
      case 'PullRequestEvent':
        if (event.payload?.action === 'opened') pullRequests++;
        break;
      case 'IssuesEvent':
        if (event.payload?.action === 'opened') issues++;
        break;
      case 'PullRequestReviewEvent':
        reviews++;
        break;
    }
  }

  return { commits, pullRequests, issues, reviews };
}

function generateEarningsHistory(events: any[]): EarningEntry[] {
  const history: EarningEntry[] = [];
  const now = new Date();

  // Generate mock earnings based on PR events
  const prEvents = events.filter(
    (e) => e.type === 'PullRequestEvent' && e.payload?.action === 'opened'
  );

  for (let i = 0; i < Math.min(prEvents.length, 20); i++) {
    const event = prEvents[i];
    const date = new Date(event.created_at);
    const reward = Math.floor(Math.random() * 400 + 100); // 100K-500K FNDRY

    history.push({
      date: date.toISOString().split('T')[0],
      amount: reward * 1000,
      bountyTitle: event.repo?.name?.split('/')[1] || `Bounty #${i + 1}`,
      bountyNumber: i + 1,
    });
  }

  return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function calculateStreak(activityData: ActivityDay[]): number {
  let streak = 0;
  const now = new Date();

  for (let i = 0; i < activityData.length; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const key = date.toISOString().split('T')[0];
    const day = activityData.find((d) => d.date === key);

    if (day && day.count > 0) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  return streak;
}
