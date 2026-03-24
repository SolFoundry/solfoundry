/**
 * Bounty boost domain types.
 * @module types/boost
 */

export type BoostStatus = 'pending' | 'confirmed' | 'refunded';

export interface Boost {
  id: string;
  bounty_id: string;
  booster_wallet: string;
  amount: number;
  status: BoostStatus;
  tx_hash: string | null;
  refund_tx_hash: string | null;
  created_at: string; // ISO datetime
}

export interface BoostListResponse {
  boosts: Boost[];
  total: number;
  total_boosted: number;
}

export interface BoostSummary {
  original_amount: number;
  total_boosted: number;
  total_amount: number;
  boost_count: number;
}

export interface BoosterLeaderboardEntry {
  rank: number;
  booster_wallet: string;
  total_boosted: number;
  boost_count: number;
}

export interface BoostLeaderboardResponse {
  leaderboard: BoosterLeaderboardEntry[];
  total_boosted: number;
}

export interface BoostRequest {
  booster_wallet: string;
  amount: number;
  tx_hash?: string;
}
