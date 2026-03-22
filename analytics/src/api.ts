/**
 * Analytics API Client — fetches on-chain and off-chain contributor data
 */

export interface ContributorStats {
  githubHandle: string;
  walletAddress?: string;
  reputation: number;
  tier: 'T1' | 'T2' | 'T3';
  totalEarned: number;
  bountiesCompleted: number;
  bountiesInProgress: number;
  averageCompletionDays: number;
  successRate: number;     // 0–1
  joinedAt: string;
  lastActiveAt: string;
  skills: string[];
  avatarUrl?: string;
  rank?: number;
}

export interface DailyActivity {
  date: string;           // ISO date YYYY-MM-DD
  submissionsCount: number;
  completionsCount: number;
  totalRewardPaid: number;
  newContributors: number;
}

export interface BountyCompletionStat {
  tier: 'T1' | 'T2' | 'T3';
  completed: number;
  pending: number;
  cancelled: number;
  totalRewardPaid: number;
}

export interface PlatformMetrics {
  totalContributors: number;
  activeContributors: number;  // active in last 30 days
  totalBountiesCompleted: number;
  totalRewardPaid: number;
  averageCompletionDays: number;
  topSkills: Array<{ skill: string; count: number }>;
}

export interface PaginatedContributors {
  data: ContributorStats[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
}

const BASE_URL = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL
  ?? 'https://api.solfoundry.io';

async function apiFetch<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Fetch the contributor leaderboard.
 */
export async function fetchContributors(opts?: {
  page?: number;
  pageSize?: number;
  tier?: string;
  search?: string;
  sortBy?: 'reputation' | 'totalEarned' | 'bountiesCompleted';
}): Promise<PaginatedContributors> {
  return apiFetch<PaginatedContributors>('/v1/contributors', {
    page:      opts?.page     ?? 1,
    page_size: opts?.pageSize ?? 20,
    ...(opts?.tier   ? { tier: opts.tier }     : {}),
    ...(opts?.search ? { search: opts.search } : {}),
    ...(opts?.sortBy ? { sort_by: opts.sortBy } : {}),
  });
}

/**
 * Fetch a single contributor's full profile.
 */
export async function fetchContributor(handle: string): Promise<ContributorStats> {
  return apiFetch<ContributorStats>(`/v1/contributors/${encodeURIComponent(handle)}`);
}

/**
 * Fetch daily platform activity for the analytics chart.
 * @param days  Number of days to look back (default 30)
 */
export async function fetchDailyActivity(days = 30): Promise<DailyActivity[]> {
  return apiFetch<DailyActivity[]>('/v1/stats/activity', { days });
}

/**
 * Fetch bounty completion rates broken down by tier.
 */
export async function fetchCompletionStats(): Promise<BountyCompletionStat[]> {
  return apiFetch<BountyCompletionStat[]>('/v1/stats/completions');
}

/**
 * Fetch high-level platform metrics for the summary cards.
 */
export async function fetchPlatformMetrics(): Promise<PlatformMetrics> {
  return apiFetch<PlatformMetrics>('/v1/stats/platform');
}
