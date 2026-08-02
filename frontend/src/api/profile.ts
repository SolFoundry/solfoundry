import { apiClient } from '../services/apiClient';

/** User profile stats returned by the backend. */
export interface ProfileStats {
  totalEarned: number;
  earnedFndry: number;
  earnedUsdc: number;
  bountiesCompleted: number;
  bountiesCreated: number;
  submissionsMade: number;
  contributionStreak: number;
  rank?: number;
  reputation?: number;
  topSkills: string[];
  /** Monthly earnings history for charting. */
  earningsHistory: MonthlyEarning[];
}

/** One month of earning data. */
export interface MonthlyEarning {
  month: string;   // e.g. "Jan"
  usdc: number;
  fndry: number;
}

/** Earning history from the backend. */
interface RawEarningHistory {
  month: string;
  usdc?: number;
  fndry?: number;
  amount?: number;
  token?: string;
}

/**
 * Fetch contributor profile stats from the backend.
 * Falls back to reasonable defaults when the API is unavailable.
 */
export async function getProfileStats(userId: string): Promise<ProfileStats> {
  try {
    const response = await apiClient<ProfileStats | Record<string, unknown>>(
      `/api/users/${userId}/stats`,
      { timeoutMs: 8_000 },
    );
    const r = response as Record<string, unknown>;

    // Normalize different response shapes
    const rawHistory = (r.earningsHistory ?? r.earnings_history ?? r.monthlyEarnings ?? []) as RawEarningHistory[];
    const earningsHistory: MonthlyEarning[] = rawHistory.map((e: RawEarningHistory) => ({
      month: e.month ?? 'Jan',
      usdc: e.usdc ?? (e.token === 'USDC' ? e.amount ?? 0 : 0),
      fndry: e.fndry ?? (e.token === 'FNDRY' ? e.amount ?? 0 : 0),
    }));

    return {
      totalEarned: (r.totalEarned as number) ?? (r.total_earned as number) ?? 0,
      earnedFndry: (r.earnedFndry as number) ?? (r.earned_fndry as number) ?? 0,
      earnedUsdc: (r.earnedUsdc as number) ?? (r.earned_usdc as number) ?? 0,
      bountiesCompleted: (r.bountiesCompleted as number) ?? (r.bounties_completed as number) ?? 0,
      bountiesCreated: (r.bountiesCreated as number) ?? (r.bounties_created as number) ?? 0,
      submissionsMade: (r.submissionsMade as number) ?? (r.submissions_made as number) ?? 0,
      contributionStreak: (r.contributionStreak as number) ?? (r.contribution_streak as number) ?? 0,
      rank: (r.rank as number) ?? undefined,
      reputation: (r.reputation as number) ?? undefined,
      topSkills: (r.topSkills as string[]) ?? (r.top_skills as string[]) ?? [],
      earningsHistory,
    };
  } catch {
    // Return empty stats when API is unavailable
    return {
      totalEarned: 0,
      earnedFndry: 0,
      earnedUsdc: 0,
      bountiesCompleted: 0,
      bountiesCreated: 0,
      submissionsMade: 0,
      contributionStreak: 0,
      topSkills: [],
      earningsHistory: [],
    };
  }
}

/**
 * Fetch approximate earnings history from the bounties the user has completed.
 */
export async function getEarningsHistoryFromBounties(userId: string): Promise<MonthlyEarning[]> {
  try {
    const response = await apiClient<{ month: string; usdc: number; fndry: number }[] | { items: { month: string; usdc: number; fndry: number }[] }>(
      `/api/users/${userId}/earnings-history`,
      { timeoutMs: 8_000 },
    );
    if (Array.isArray(response)) return response;
    return response.items ?? [];
  } catch {
    return [];
  }
}