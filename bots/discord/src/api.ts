/**
 * SolFoundry API client for the Discord bot.
 */

import { env } from './config';

export interface Bounty {
  id: string;
  title: string;
  description: string;
  reward_amount: number;
  reward_token: string;
  tier: string;
  status: string;
  skills: string[];
  created_at: string;
  deadline: string | null;
  github_repo_url: string | null;
  github_issue_url: string | null;
}

export interface LeaderboardEntry {
  username: string;
  avatar_url: string | null;
  bounties_completed: number;
  total_earned: number;
  rank: number;
}

/* ─── Fetch helpers ─── */

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path, env.SOLFOUNDRY_API_URL);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`SolFoundry API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

/* ─── Bounty methods ─── */

export async function fetchLatestBounties(since: string): Promise<Bounty[]> {
  const data = await apiFetch<{ items: Bounty[] }>('/api/bounties', {
    status: 'open',
    limit: '10',
    sort: 'created_at',
    order: 'desc',
  });

  // Filter to only bounties created after `since`
  return data.items.filter(b => new Date(b.created_at) > new Date(since));
}

export async function fetchOpenBounties(limit = 10): Promise<Bounty[]> {
  const data = await apiFetch<{ items: Bounty[] }>('/api/bounties', {
    status: 'open',
    limit: String(limit),
    sort: 'reward_amount',
    order: 'desc',
  });
  return data.items;
}

/* ─── Leaderboard methods ─── */

export async function fetchLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
  const data = await apiFetch<{ entries: LeaderboardEntry[] }>('/api/leaderboard', {
    limit: String(limit),
  });
  return data.entries ?? [];
}
