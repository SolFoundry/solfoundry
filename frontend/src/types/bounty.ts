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

// ── Advanced Search / Filter Types ──

/** Filter set persisted in localStorage */
export interface SavedFilterSet {
  id: string;
  name: string;
  filters: AdvancedFilters;
  createdAt: string;
}

/** Advanced filters for the bounty search experience */
export interface AdvancedFilters {
  query: string;
  languages: string[];
  tiers: BountyTier[];
  domains: string[];
  rewardMin: number;
  rewardMax: number;
}

/** Simpler board-level filters used by BountyFilters component */
export type BountyCategory = 'all' | 'defi' | 'infra' | 'security' | 'nft' | 'dao' | 'gaming' | 'ai-ml' | 'data' | 'mobile';

export interface BountyBoardFilters {
  category: BountyCategory;
  skills: string[];
  status: BountyStatus | 'all';
  deadlineBefore: string;
  rewardMin: number;
  rewardMax: number;
}

// ── Constants ──

export const AVAILABLE_LANGUAGES = [
  'TypeScript',
  'JavaScript',
  'Rust',
  'Python',
  'Go',
  'Solidity',
  'Move',
  'C++',
  'Java',
  'Swift',
  'Kotlin',
  'C#',
] as const;

export const AVAILABLE_TIERS: BountyTier[] = ['T1', 'T2', 'T3'];

export const AVAILABLE_DOMAINS = [
  'DeFi',
  'Infrastructure',
  'Security',
  'NFT / Gaming',
  'DAO / Governance',
  'AI / ML',
  'Data Analytics',
  'Mobile',
  'DevTools',
  'Cross-chain',
] as const;

export const REWARD_PRESETS = [
  { label: 'All', min: 0, max: Infinity },
  { label: '< 1K', min: 0, max: 1000 },
  { label: '1K–5K', min: 1000, max: 5000 },
  { label: '5K–25K', min: 5000, max: 25000 },
  { label: '25K–100K', min: 25000, max: 100000 },
  { label: '100K+', min: 100000, max: Infinity },
] as const;

export const SAVED_FILTERS_KEY = 'solfoundry_saved_filters';

export const DEFAULT_ADVANCED_FILTERS: AdvancedFilters = {
  query: '',
  languages: [],
  tiers: [],
  domains: [],
  rewardMin: 0,
  rewardMax: Infinity,
};

export const DEFAULT_FILTERS: BountyBoardFilters = {
  category: 'all',
  skills: [],
  status: 'all',
  deadlineBefore: '',
  rewardMin: 0,
  rewardMax: Infinity,
};

export const BOUNTY_CATEGORIES: { value: BountyCategory; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'defi', label: 'DeFi' },
  { value: 'infra', label: 'Infrastructure' },
  { value: 'security', label: 'Security' },
  { value: 'nft', label: 'NFT / Gaming' },
  { value: 'dao', label: 'DAO / Governance' },
  { value: 'ai-ml', label: 'AI / ML' },
  { value: 'data', label: 'Data Analytics' },
  { value: 'mobile', label: 'Mobile' },
];
