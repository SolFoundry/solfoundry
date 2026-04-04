export type BountyStatus = 'open' | 'in_review' | 'completed' | 'cancelled' | 'funded';
export type BountyTier = 'T1' | 'T2' | 'T3';
export type RewardToken = 'USDC' | 'FNDRY';

export interface Bounty {
  id: string;
  title: string;
  description: string;
  status: BountyStatus;
  tier: BountyTier;
  skills: string[];
  deadline?: string | null;
  category?: string | null;
  // snake_case API fields
  reward_amount?: number;
  reward_token?: RewardToken;
  github_issue_url?: string | null;
  github_repo_url?: string | null;
  org_name?: string | null;
  repo_name?: string | null;
  org_avatar_url?: string | null;
  issue_number?: number | null;
  submission_count?: number;
  created_at?: string;
  creator_id?: string | null;
  creator_username?: string | null;
  has_repo?: boolean;
  // camelCase frontend fields (BountyBoard components)
  rewardAmount?: number;
  currency?: 'USDC' | 'FNDRY';
  submissionCount?: number;
  createdAt?: string;
  projectName?: string;
  creatorType?: 'community' | 'platform';
}

export interface BountyBoardFilters {
  category: string;
  skills: string[];
  tier: string;
  deadlineBefore?: string;
  rewardMin?: number;
  rewardMax?: number;
}

export const DEFAULT_FILTERS: BountyBoardFilters = {
  category: 'all',
  skills: [],
  tier: 'all',
};

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

export interface TreasuryDepositInfo {
  bounty_id: string;
  treasury_address: string;
  amount_usdc: number;
  platform_fee: number;
  total_to_fund: number;
}

export interface EscrowVerifyPayload {
  bounty_id: string;
  tx_signature: string;
}

export interface EscrowVerifyResult {
  verified: boolean;
  bounty_id: string;
  amount_verified?: number;
  error?: string;
}
