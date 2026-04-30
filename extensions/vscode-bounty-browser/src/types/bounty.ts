/**
 * TypeScript types for SolFoundry bounty data structures.
 * Mirrors the frontend types at frontend/src/types/bounty.ts
 */

export type BountyStatus = 'open' | 'in_review' | 'completed' | 'cancelled' | 'funded';
export type BountyTier = 'T1' | 'T2' | 'T3';
export type RewardToken = 'USDC' | 'FNDRY';

export interface Bounty {
  id: string;
  title: string;
  description: string;
  status: BountyStatus;
  tier: BountyTier;
  reward_amount: number;
  reward_token: RewardToken;
  github_issue_url?: string | null;
  github_repo_url?: string | null;
  org_name?: string | null;
  repo_name?: string | null;
  org_avatar_url?: string | null;
  issue_number?: number | null;
  category?: string | null;
  skills: string[];
  deadline?: string | null;
  submission_count: number;
  created_at: string;
  creator_id?: string | null;
  creator_username?: string | null;
  has_repo?: boolean;
}

export interface Submission {
  id: string;
  bounty_id: string;
  contributor_id: string;
  contributor_username?: string | null;
  contributor_avatar?: string | null;
  repo_url?: string | null;
  pr_url?: string | null;
  description?: string | null;
  status: 'pending' | 'in_review' | 'approved' | 'rejected';
  review_score?: number | null;
  earned?: number | null;
  created_at: string;
}

export interface BountiesListParams {
  status?: string;
  limit?: number;
  offset?: number;
  skill?: string;
  tier?: string;
  reward_token?: string;
}

export interface BountiesListResponse {
  items: Bounty[];
  total: number;
  limit: number;
  offset: number;
}

export interface SubmissionCreatePayload {
  repo_url?: string;
  pr_url?: string;
  description?: string;
  tx_signature?: string;
}

export interface ReviewFeeInfo {
  bounty_id: string;
  required: boolean;
  fndry_amount: number;
  fndry_price_usd: number;
  usdc_bounty_value: number;
  fee_percentage: number;
  exchange_rate: number;
  price_source: string;
}

export interface User {
  id: string;
  github_id?: string | null;
  username: string;
  email?: string | null;
  avatar_url?: string | null;
  wallet_address?: string | null;
  created_at?: string | null;
}
