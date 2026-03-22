/**
 * SolFoundry SDK — TypeScript types
 */

export type BountyStatus =
  | 'open'
  | 'in_progress'
  | 'under_review'
  | 'completed'
  | 'cancelled'
  | 'disputed';

export type BountyTier = 'T1' | 'T2' | 'T3';

export interface Bounty {
  id: string;
  title: string;
  description: string;
  reward: number;
  rewardToken: string;
  status: BountyStatus;
  tier: BountyTier;
  tags: string[];
  issueUrl: string;
  issueNumber: number;
  createdAt: string;
  updatedAt: string;
  deadline?: string;
  claimedBy?: string;
  prUrl?: string;
}

export interface Contributor {
  id: string;
  githubHandle: string;
  walletAddress?: string;
  reputation: number;
  tier: BountyTier;
  totalEarned: number;
  bountiesCompleted: number;
  bountiesInProgress: number;
  joinedAt: string;
  avatarUrl?: string;
  bio?: string;
  skills: string[];
}

export interface WorkSubmission {
  id: string;
  bountyId: string;
  contributorId: string;
  prUrl: string;
  status: 'pending' | 'approved' | 'rejected' | 'needs_changes';
  submittedAt: string;
  reviewedAt?: string;
  reviewNotes?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
}

export interface SolFoundryClientConfig {
  /** Base URL of the SolFoundry API. Defaults to https://api.solfoundry.io */
  baseUrl?: string;
  /** API key for authenticated requests */
  apiKey?: string;
  /** Request timeout in milliseconds. Defaults to 10000 */
  timeout?: number;
  /** Custom fetch implementation (useful for testing) */
  fetch?: typeof globalThis.fetch;
}

export interface BountyFilter {
  status?: BountyStatus;
  tier?: BountyTier;
  tags?: string[];
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface ContributorFilter {
  tier?: BountyTier;
  page?: number;
  pageSize?: number;
  search?: string;
  minReputation?: number;
}

export interface SubmitWorkParams {
  bountyId: string;
  prUrl: string;
  notes?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
