/**
 * SolFoundry SDK — Leaderboard & Stats Client.
 *
 * Provides access to platform leaderboards, contributor rankings,
 * and platform-wide statistics.
 *
 * @module leaderboard
 */

import type { HttpClient } from './client.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Time period for leaderboard filtering. */
export type TimePeriod = '7d' | '30d' | '90d' | 'all';

/** A single entry on the leaderboard. */
export interface LeaderboardEntry {
  /** Current rank on the leaderboard. */
  rank: number;
  /** Username (GitHub login). */
  username: string;
  /** Avatar URL. */
  avatarUrl?: string | null;
  /** Total reputation points. */
  points: number;
  /** Number of bounties completed. */
  bountiesCompleted: number;
  /** Total $FNDRY tokens earned. */
  earningsFndry: number;
  /** Total SOL earned. */
  earningsSol: number;
  /** Current contribution streak (days). */
  streak?: number | null;
  /** Top skills tags. */
  topSkills: string[];
  /** Computed reputation score. */
  reputation: number;
  /** Amount of $FNDRY staked. */
  stakedFndry: number;
  /** Reputation boost from staking. */
  reputationBoost: number;
}

/** Platform-wide statistics. */
export interface PlatformStats {
  /** Number of currently open bounties. */
  open_bounties: number;
  /** Total USDC paid out across all completed bounties. */
  total_paid_usdc: number;
  /** Total unique contributors who have earned rewards. */
  total_contributors: number;
  /** Total bounties created (all statuses). */
  total_bounties: number;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/**
 * Client for the SolFoundry leaderboard and platform stats API.
 *
 * @example
 * ```typescript
 * const lb = new LeaderboardClient(http);
 *
 * // Get top contributors this month
 * const leaders = await lb.getLeaderboard('30d');
 * leaders.forEach(e => console.log(`#${e.rank} ${e.username}: ${e.earningsFndry} $FNDRY`));
 *
 * // Platform stats
 * const stats = await lb.getStats();
 * console.log(`${stats.open_bounties} open bounties, ${stats.total_contributors} contributors`);
 * ```
 */
export class LeaderboardClient {
  private readonly http: HttpClient;

  /**
   * Create a LeaderboardClient.
   *
   * @param http - The shared {@link HttpClient} instance.
   */
  constructor(http: HttpClient) {
    this.http = http;
  }

  // -----------------------------------------------------------------------
  // Leaderboard
  // -----------------------------------------------------------------------

  /**
   * Fetch the contributor leaderboard for a given time period.
   *
   * @param period - Time window for rankings. Defaults to 'all'.
   * @returns Sorted array of leaderboard entries (rank 1 first).
   *
   * @example
   * ```typescript
   * const top10 = (await client.leaderboard.getLeaderboard('7d')).slice(0, 10);
   * ```
   */
  async getLeaderboard(period?: TimePeriod): Promise<LeaderboardEntry[]> {
    const params: Record<string, string> = {};
    if (period && period !== 'all') params.period = period;

    const response = await this.http.request<LeaderboardEntry[] | { items: LeaderboardEntry[] }>({
      path: '/api/leaderboard',
      method: 'GET',
      params,
    });

    if (Array.isArray(response)) return response;
    return response.items ?? [];
  }

  // -----------------------------------------------------------------------
  // Platform Stats
  // -----------------------------------------------------------------------

  /**
   * Fetch platform-wide statistics (bounty counts, payouts, contributors).
   *
   * Useful for landing pages, dashboards, and health checks.
   *
   * @returns Current platform statistics.
   *
   * @example
   * ```typescript
   * const stats = await client.leaderboard.getStats();
   * console.log(`${stats.open_bounties} bounties open, $${stats.total_paid_usdc} paid`);
   * ```
   */
  async getStats(): Promise<PlatformStats> {
    const response = await this.http.request<PlatformStats | Record<string, unknown>>({
      path: '/api/stats',
      method: 'GET',
    });

    // Normalize response shape (backend may return different field names)
    const r = response as Record<string, unknown>;
    return {
      open_bounties: (r.open_bounties as number) ?? (r.active_bounties as number) ?? 0,
      total_paid_usdc: (r.total_paid_usdc as number) ?? (r.total_rewards_paid as number) ?? 0,
      total_contributors: (r.total_contributors as number) ?? (r.contributors as number) ?? 0,
      total_bounties: (r.total_bounties as number) ?? 0,
    };
  }
}
