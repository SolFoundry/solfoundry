export type BountyTier = 'T1' | 'T2' | 'T3';
export type BountyStatus = 'draft' | 'open' | 'claimed' | 'in-progress' | 'in_review' | 'completed' | 'disputed' | 'paid' | 'cancelled';
export type BountySortBy = 'newest' | 'reward_high' | 'reward_low' | 'deadline' | 'submissions' | 'best_match';

export interface Bounty {
  id: string;
  title: string;
  description: string;
  tier: BountyTier;
  skills: string[];
  rewardAmount: number;
  currency: string;
  deadline: string;
  status: BountyStatus;
  submissionCount: number;
  createdAt: string;
  projectName: string;
  githubIssueUrl?: string;
  relevanceScore?: number;
  skillMatchCount?: number;
}

export type BountyCategory = 'smart-contract' | 'frontend' | 'backend' | 'design' | 'content' | 'security' | 'devops' | 'documentation';

export interface BountyBoardFilters {
  tier: BountyTier | 'all';
  status: BountyStatus | 'all';
  skills: string[];
  searchQuery: string;
  rewardMin: string;
  rewardMax: string;
  creatorType: 'all' | 'platform' | 'community';
  category: BountyCategory | 'all';
  deadlineBefore: string;
}

export const DEFAULT_FILTERS: BountyBoardFilters = {
  tier: 'all',
  status: 'all',
  skills: [],
  searchQuery: '',
  rewardMin: '',
  rewardMax: '',
  creatorType: 'all',
  category: 'all',
  deadlineBefore: '',
};

export const SKILL_OPTIONS = ['React', 'TypeScript', 'Rust', 'Anchor', 'Solana', 'Node.js', 'Python', 'FastAPI', 'Security', 'Content'];

export const TIER_OPTIONS: { value: BountyTier | 'all'; label: string }[] = [
  { value: 'all', label: 'All Tiers' },
  { value: 'T1', label: 'T1 — Open Race' },
  { value: 'T2', label: 'T2 — Assigned' },
  { value: 'T3', label: 'T3 — Elite' },
];

export const STATUS_OPTIONS: { value: BountyStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'open', label: 'Open' },
  { value: 'claimed', label: 'Claimed' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'in_review', label: 'In Review' },
  { value: 'completed', label: 'Completed' },
  { value: 'paid', label: 'Paid' },
];

export const SORT_OPTIONS: { value: BountySortBy; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'reward_high', label: 'Highest Reward' },
  { value: 'reward_low', label: 'Lowest Reward' },
  { value: 'deadline', label: 'Ending Soon' },
  { value: 'submissions', label: 'Most Submissions' },
  { value: 'best_match', label: 'Best Match' },
];

export const CREATOR_TYPE_OPTIONS: { value: 'all' | 'platform' | 'community'; label: string }[] = [
  { value: 'all', label: 'All Creators' },
  { value: 'platform', label: 'Platform' },
  { value: 'community', label: 'Community' },
];

export const CATEGORY_OPTIONS: { value: BountyCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All Categories' },
  { value: 'smart-contract', label: 'Smart Contract' },
  { value: 'frontend', label: 'Frontend' },
  { value: 'backend', label: 'Backend' },
  { value: 'design', label: 'Design' },
  { value: 'content', label: 'Content' },
  { value: 'security', label: 'Security' },
  { value: 'devops', label: 'DevOps' },
  { value: 'documentation', label: 'Documentation' },
];

export interface SearchResponse {
  items: Bounty[];
  total: number;
  page: number;
  per_page: number;
  query: string;
}

export interface AutocompleteItem {
  text: string;
  type: 'title' | 'skill';
  bounty_id?: string;
}
