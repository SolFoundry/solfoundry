export type BountyTier = 'T1' | 'T2' | 'T3';
export type BountyStatus = 'open' | 'in-progress' | 'under_review' | 'completed' | 'disputed' | 'paid' | 'cancelled';
export type BountySortBy = 'newest' | 'reward_high' | 'reward_low' | 'deadline' | 'submissions' | 'submissions_low' | 'best_match';
export type SubmissionStatus = 'pending' | 'approved' | 'disputed' | 'paid' | 'rejected';

export type CreatorType = 'platform' | 'community';

export interface ModelReviewScore {
  model_name: string;
  quality_score: number;
  correctness_score: number;
  security_score: number;
  completeness_score: number;
  test_coverage_score: number;
  overall_score: number;
  review_summary?: string;
  review_status: string;
}

export interface AggregatedReviewScore {
  submission_id: string;
  bounty_id: string;
  model_scores: ModelReviewScore[];
  overall_score: number;
  meets_threshold: boolean;
  review_complete: boolean;
  quality_avg: number;
  correctness_avg: number;
  security_avg: number;
  completeness_avg: number;
  test_coverage_avg: number;
}

export interface BountySubmission {
  id: string;
  bounty_id: string;
  pr_url: string;
  submitted_by: string;
  contributor_wallet?: string;
  notes?: string;
  status: SubmissionStatus;
  ai_score: number;
  ai_scores_by_model: Record<string, number>;
  review_complete: boolean;
  meets_threshold: boolean;
  auto_approve_eligible: boolean;
  auto_approve_after?: string;
  approved_by?: string;
  approved_at?: string;
  payout_tx_hash?: string;
  payout_amount?: number;
  payout_at?: string;
  winner: boolean;
  submitted_at: string;
}

export interface LifecycleLogEntry {
  id: string;
  bounty_id: string;
  submission_id?: string;
  event_type: string;
  previous_state?: string;
  new_state?: string;
  actor_id?: string;
  actor_type?: string;
  details?: Record<string, unknown>;
  created_at: string;
}

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
  creatorType: CreatorType;
  githubIssueUrl?: string;
  relevanceScore?: number;
  skillMatchCount?: number;
  submissions?: BountySubmission[];
  winner_submission_id?: string;
  winner_wallet?: string;
  payout_tx_hash?: string;
  payout_at?: string;
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
  { value: 'open', label: 'Open' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'completed', label: 'Completed' },
  { value: 'disputed', label: 'Disputed' },
  { value: 'paid', label: 'Paid' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const SORT_OPTIONS: { value: BountySortBy; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'reward_high', label: 'Highest Reward' },
  { value: 'reward_low', label: 'Lowest Reward' },
  { value: 'deadline', label: 'Ending Soon' },
  { value: 'submissions', label: 'Most Submissions' },
  { value: 'submissions_low', label: 'Fewest Submissions' },
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
