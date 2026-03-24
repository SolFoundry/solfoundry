/**
 * Leaderboard domain types shared by hook, components, and tests.
 * @module types/leaderboard
 */

/** Time range filter for the leaderboard API query. */
export type TimeRange = '7d' | '30d' | '90d' | 'all';

/** Fields the leaderboard table can be sorted by. */
export type SortField = 'points' | 'bounties' | 'earnings' | 'reputation' | 'staked';

/** A single contributor row returned by the leaderboard API. */
export interface Contributor {
  rank: number;
  username: string;
  avatarUrl: string;
  points: number;
  bountiesCompleted: number;
  earningsFndry: number;
  earningsSol: number;
  streak: number;
  topSkills: string[];
  /** Phase 3: On-chain reputation score (0–100). */
  reputation: number;
  /** Phase 3: Total $FNDRY staked. */
  stakedFndry: number;
  /** Phase 3: Reputation multiplier from staking (e.g. 1.0–2.0). */
  reputationBoost: number;
}
