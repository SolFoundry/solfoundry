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

// LLM Review types for Bounty Detail Page
export type LLMProvider = 'claude' | 'codex' | 'gemini';

export interface LLMReviewScore {
  provider: LLMProvider;
  score: number;           // 0-10
  confidence: number;      // 0-100 percentage
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  summary: string;
  strengths: string[];
  weaknesses: string[];
  full_review_url?: string;
}

export interface LLMReviewResult {
  bounty_id: string;
  reviews: LLMReviewScore[];
  aggregate_score: number;
  pass_threshold: number;
  reviewed_at: string;
}

// Mock review data for demo/development
export function getMockLLMReviews(bountyId: string): LLMReviewResult {
  return {
    bounty_id: bountyId,
    aggregate_score: 7.8,
    pass_threshold: 7.0,
    reviewed_at: new Date().toISOString(),
    reviews: [
      {
        provider: 'claude',
        score: 8.2,
        confidence: 92,
        quality: 'excellent',
        summary: 'Well-structured code with clear separation of concerns. Good error handling and type safety.',
        strengths: ['Clean architecture', 'Type safety', 'Error handling'],
        weaknesses: ['Could improve test coverage'],
        full_review_url: 'https://claude.ai/review/' + bountyId,
      },
      {
        provider: 'codex',
        score: 7.5,
        confidence: 88,
        quality: 'good',
        summary: 'Functional implementation meets requirements. Some optimization opportunities in data fetching.',
        strengths: ['Functional correctness', 'API integration'],
        weaknesses: ['Data fetching optimization', 'Edge case handling'],
        full_review_url: 'https://openai.com/codex/review/' + bountyId,
      },
      {
        provider: 'gemini',
        score: 7.8,
        confidence: 85,
        quality: 'good',
        summary: 'Solid implementation with good documentation. UI/UX could be more polished.',
        strengths: ['Documentation', 'Code readability'],
        weaknesses: ['UI polish', 'Accessibility'],
        full_review_url: 'https://gemini.google.com/review/' + bountyId,
      },
    ],
  };
}
