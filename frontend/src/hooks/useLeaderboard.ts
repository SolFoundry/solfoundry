/**
 * useLeaderboard - Data-fetching hook for the contributor leaderboard.
 * Tries GET /api/leaderboard via apiClient, falls back to GitHub API for merged PRs,
 * merges with known Phase 1 payout data.
 * @module hooks/useLeaderboard
 */
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Contributor, TimeRange, SortField } from '../types/leaderboard';
import { apiClient, isApiError } from '../services/apiClient';

const REPO = 'SolFoundry/solfoundry';
const GITHUB_API = 'https://api.github.com';

/** Known Phase 1 payout data (on-chain payouts). */
const KNOWN_PAYOUTS: Record<string, { bounties: number; fndry: number; skills: string[] }> = {
  HuiNeng6: { bounties: 12, fndry: 1_800_000, skills: ['Python', 'FastAPI', 'React', 'TypeScript', 'WebSocket'] },
  ItachiDevv: { bounties: 8, fndry: 1_750_000, skills: ['React', 'TypeScript', 'Tailwind', 'Solana'] },
  LaphoqueRC: { bounties: 1, fndry: 150_000, skills: ['Frontend', 'React'] },
  zhaog100: { bounties: 1, fndry: 150_000, skills: ['Backend', 'Python', 'FastAPI'] },
};

/** Fetch merged PRs from GitHub to build contributor stats. */
async function fetchGitHubContributors(): Promise<Contributor[]> {
  const url = `${GITHUB_API}/repos/${REPO}/pulls?state=closed&per_page=100&sort=updated&direction=desc`;
  const response = await fetch(url);
  if (!response.ok) return [];

  const pullRequests = await response.json();
  if (!Array.isArray(pullRequests)) return [];

  // Count merged PRs per author
  const authorStats: Record<string, { prCount: number; avatar: string }> = {};
  for (const pullRequest of pullRequests) {
    if (!pullRequest.merged_at) continue;
    const login = pullRequest.user?.login;
    if (!login || login.includes('[bot]')) continue;
    if (!authorStats[login]) authorStats[login] = { prCount: 0, avatar: pullRequest.user.avatar_url || '' };
    authorStats[login].prCount++;
  }

  // Merge with known payout data
  const allAuthors = new Set([...Object.keys(KNOWN_PAYOUTS), ...Object.keys(authorStats)]);
  const contributors: Contributor[] = [];

  for (const author of allAuthors) {
    const known = KNOWN_PAYOUTS[author];
    const prData = authorStats[author];
    const totalPrs = prData?.prCount || 0;
    const bounties = known?.bounties || totalPrs;
    const earnings = known?.fndry || 0;
    const skills = known?.skills || [];
    const avatar = prData?.avatar || `https://avatars.githubusercontent.com/${author}`;

    // Reputation score
    let reputation = 0;
    reputation += Math.min(totalPrs * 5, 40);
    reputation += Math.min(bounties * 5, 40);
    reputation += Math.min(skills.length * 3, 20);
    reputation = Math.min(reputation, 100);

    contributors.push({
      rank: 0,
      username: author,
      avatarUrl: avatar,
      points: reputation * 100 + bounties * 50,
      bountiesCompleted: bounties,
      earningsFndry: earnings,
      earningsSol: 0,
      streak: Math.max(1, Math.floor(bounties / 2)),
      topSkills: skills.slice(0, 3),
    });
  }

  return contributors;
}

/** Try backend API via apiClient, fall back to GitHub. */
async function fetchLeaderboard(timeRange: TimeRange): Promise<Contributor[]> {
  try {
    const data = await apiClient<Contributor[]>('/api/leaderboard', { params: { range: timeRange }, retries: 1 });
    if (Array.isArray(data) && data.length > 0) return data;
  } catch (error: unknown) {
    if (isApiError(error) && error.status >= 400 && error.status < 500) throw error;
  }
  return fetchGitHubContributors();
}

/** Leaderboard hook with React Query caching. */
export function useLeaderboard() {
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [sortBy, setSortBy] = useState<SortField>('points');
  const [search, setSearch] = useState('');

  const { data: contributors = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: ['leaderboard', timeRange],
    queryFn: () => fetchLeaderboard(timeRange),
    staleTime: 60_000,
  });

  const error = queryError
    ? (queryError instanceof Error ? queryError.message : 'Failed to load leaderboard')
    : null;

  const sorted = useMemo(() => {
    let list = [...contributors];
    if (search) list = list.filter(contributor => contributor.username.toLowerCase().includes(search.toLowerCase()));
    list.sort((left, right) => {
      const leftValue = sortBy === 'bounties' ? left.bountiesCompleted : sortBy === 'earnings' ? left.earningsFndry : left.points;
      const rightValue = sortBy === 'bounties' ? right.bountiesCompleted : sortBy === 'earnings' ? right.earningsFndry : right.points;
      return rightValue - leftValue;
    });
    return list.map((contributor, index) => ({ ...contributor, rank: index + 1 }));
  }, [contributors, sortBy, search]);

  return { contributors: sorted, loading, error, timeRange, setTimeRange, sortBy, setSortBy, search, setSearch };
}
