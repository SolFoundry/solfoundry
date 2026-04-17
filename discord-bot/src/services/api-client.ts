/**
 * SolFoundry API client for the Discord bot.
 *
 * Fetches bounties, contributors, and stats from the SolFoundry REST API.
 * Designed to work with the SDK types but operates standalone to avoid
 * coupling with the SDK build pipeline.
 */

import type { UserFilter } from './filter-store.js';

const BASE_URL = process.env.SOLFOUNDRY_API_URL ?? 'https://api.solfoundry.io';
const API_TOKEN = process.env.SOLFOUNDRY_API_TOKEN ?? '';

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Accept': 'application/json' };
  if (API_TOKEN) h['Authorization'] = `Bearer ${API_TOKEN}`;
  return h;
}

// --- Types (mirrored from SDK) ---

export interface BountyListItem {
  id: string;
  title: string;
  tier: number;
  reward_amount: number;
  status: string;
  category: string | null;
  creator_type: string;
  required_skills: string[];
  github_issue_url: string | null;
  deadline: string | null;
  created_by: string;
  created_at: string;
}

export interface ContributorListItem {
  id: string;
  username: string;
  reputation_score: number;
  bounties_completed: number;
  total_earned: number;
  skills: string[];
}

// --- API Methods ---

export async function fetchBounties(params?: Record<string, string>): Promise<BountyListItem[]> {
  const url = new URL('/api/bounties', BASE_URL);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { headers: headers() });
  if (!res.ok) throw new Error(`Failed to fetch bounties: ${res.status}`);
  const data = await res.json();
  // API returns { items: [...] } or [...]
  return Array.isArray(data) ? data : data.items ?? [];
}

export async function fetchContributors(params?: Record<string, string>): Promise<ContributorListItem[]> {
  const url = new URL('/api/contributors', BASE_URL);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { headers: headers() });
  if (!res.ok) throw new Error(`Failed to fetch contributors: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : data.items ?? [];
}

export async function fetchStats(): Promise<{ total_bounties: number; total_paid: number; active_contributors: number }> {
  const url = new URL('/api/stats', BASE_URL);
  const res = await fetch(url.toString(), { headers: headers() });
  if (!res.ok) throw new Error(`Failed to fetch stats: ${res.status}`);
  return res.json();
}

/**
 * Get the tier label (T1, T2, T3) with emoji.
 */
export function tierLabel(tier: number): string {
  switch (tier) {
    case 1: return '🟢 T1';
    case 2: return '🟡 T2';
    case 3: return '🔴 T3';
    default: return `⬜ T${tier}`;
  }
}

/**
 * Format reward amount with $FNDRY suffix.
 */
export function formatReward(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M $FNDRY`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K $FNDRY`;
  return `${amount} $FNDRY`;
}