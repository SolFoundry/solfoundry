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

export interface BountyListResponse {
  items: Bounty[];
  total: number;
  limit: number;
  offset: number;
}

export interface BountySearchParams {
  q?: string;
  status?: string;
  tier?: string;
  category?: string;
  reward_min?: number;
  reward_max?: number;
  skills?: string[];
  sort?: string;
  page?: number;
  per_page?: number;
}

export interface BountySearchResponse {
  items: Bounty[];
  total: number;
  page: number;
  per_page: number;
}

export interface FilterState {
  language: string;
  rewardMin: number;
  rewardMax: number;
  tier: string;
  status: string;
}
