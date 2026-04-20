/**
 * SolFoundry MCP Server — Type Definitions
 * Mirrors the SolFoundry REST API contract types.
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
  issue_number?: number | null;
  category?: string | null;
  skills: string[];
  deadline?: string | null;
  submission_count: number;
  created_at: string;
  creator_id?: string | null;
  creator_username?: string | null;
}

export interface BountyCreatePayload {
  title: string;
  description: string;
  reward_amount: number;
  reward_token: RewardToken;
  deadline?: string | null;
  github_repo_url?: string | null;
  github_issue_url?: string | null;
  tier?: BountyTier | null;
  skills?: string[];
}

export interface BountyUpdatePayload {
  title?: string;
  description?: string;
  status?: BountyStatus;
  reward_amount?: number;
  deadline?: string | null;
  skills?: string[];
}

export interface BountiesListParams {
  status?: BountyStatus;
  tier?: BountyTier;
  reward_token?: RewardToken;
  skill?: string;
  limit?: number;
  offset?: number;
}

export interface BountiesListResponse {
  items: Bounty[];
  total: number;
  limit: number;
  offset: number;
}

export interface Submission {
  id: string;
  bounty_id: string;
  contributor_id: string;
  contributor_username?: string | null;
  pr_url?: string | null;
  description?: string | null;
  status: 'pending' | 'in_review' | 'approved' | 'rejected';
  review_score?: number | null;
  earned?: number | null;
  created_at: string;
}

export interface LeaderboardEntry {
  username: string;
  avatar_url?: string;
  total_earned: number;
  bounties_completed: number;
  rank: number;
}

export interface PlatformStats {
  open_bounties: number;
  total_paid_usdc: number;
  total_contributors: number;
  total_bounties: number;
}

export interface BatchConfig {
  bounties: BountyCreatePayload[];
}

export interface SolFoundryConfig {
  baseUrl: string;
  authToken: string | undefined;
}
