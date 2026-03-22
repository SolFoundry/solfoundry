/**
 * Core type definitions for the SolFoundry SDK.
 * These types mirror the SolFoundry API response shapes.
 */

/** Bounty status values */
export type BountyStatus = 'open' | 'in_progress' | 'under_review' | 'completed' | 'cancelled';

/** Bounty difficulty tiers */
export type BountyTier = 'T1' | 'T2' | 'T3';

/** Contributor tier levels */
export type ContributorTier = 'newcomer' | 'contributor' | 'senior' | 'maintainer';

/** Work submission status */
export type SubmissionStatus = 'pending' | 'accepted' | 'rejected' | 'needs_revision';

/**
 * Represents a bounty on the SolFoundry platform.
 */
export interface Bounty {
  /** Unique numeric ID of the bounty */
  id: number;
  /** GitHub issue number this bounty is linked to */
  issueNumber: number;
  /** Short title of the bounty */
  title: string;
  /** Full markdown description of the requirements */
  description: string;
  /** Reward amount in $FNDRY tokens */
  rewardFndry: number;
  /** Current status of the bounty */
  status: BountyStatus;
  /** Difficulty tier */
  tier: BountyTier;
  /** Tags / labels on this bounty */
  tags: string[];
  /** GitHub handle of the contributor currently working on it, if any */
  assignee: string | null;
  /** Solana wallet address of the bounty creator */
  creatorWallet: string;
  /** On-chain escrow account address, once funded */
  escrowAccount: string | null;
  /** ISO 8601 creation timestamp */
  createdAt: string;
  /** ISO 8601 timestamp of last update */
  updatedAt: string;
  /** ISO 8601 deadline, if set */
  deadline: string | null;
}

/**
 * Pagination metadata returned with list responses.
 */
export interface PaginationMeta {
  /** Total number of items across all pages */
  total: number;
  /** Current page number (1-indexed) */
  page: number;
  /** Number of items per page */
  pageSize: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether there is a next page */
  hasNextPage: boolean;
  /** Whether there is a previous page */
  hasPrevPage: boolean;
}

/**
 * Paginated list response wrapper.
 */
export interface PaginatedList<T> {
  items: T[];
  pagination: PaginationMeta;
}

/**
 * Represents a contributor registered on the SolFoundry platform.
 */
export interface Contributor {
  /** GitHub handle (unique identifier) */
  githubHandle: string;
  /** Display name */
  displayName: string;
  /** Contributor tier */
  tier: ContributorTier;
  /** Solana wallet address */
  walletAddress: string;
  /** Total $FNDRY earned across all bounties */
  totalEarned: number;
  /** Number of bounties successfully completed */
  completedBounties: number;
  /** Number of bounties currently in progress */
  activeBounties: number;
  /** Overall reputation score (0–1000) */
  reputationScore: number;
  /** Whether the contributor is currently approved/active */
  isActive: boolean;
  /** ISO 8601 registration timestamp */
  registeredAt: string;
  /** Avatar URL from GitHub */
  avatarUrl: string | null;
}

/**
 * A work submission linking a contributor's PR to a bounty.
 */
export interface WorkSubmission {
  /** Unique submission ID */
  id: string;
  /** The bounty this submission is for */
  bountyId: number;
  /** GitHub handle of the submitter */
  contributorHandle: string;
  /** URL of the pull request */
  prUrl: string;
  /** GitHub PR number */
  prNumber: number;
  /** Current review status */
  status: SubmissionStatus;
  /** Optional notes from the reviewer */
  reviewNotes: string | null;
  /** ISO 8601 timestamp when submitted */
  submittedAt: string;
  /** ISO 8601 timestamp of last status change */
  reviewedAt: string | null;
}

/**
 * Request body for submitting work on a bounty.
 */
export interface SubmitWorkRequest {
  /** ID of the bounty to claim */
  bountyId: number;
  /** Full URL of the pull request */
  prUrl: string;
  /** Optional description or notes for the reviewer */
  notes?: string;
}

/**
 * Options for filtering bounty list queries.
 */
export interface BountyListOptions {
  /** Filter by status */
  status?: BountyStatus;
  /** Filter by tier */
  tier?: BountyTier;
  /** Filter by tag */
  tag?: string;
  /** Search in title/description */
  search?: string;
  /** Page number (default: 1) */
  page?: number;
  /** Items per page (default: 20, max: 100) */
  pageSize?: number;
  /** Sort field */
  sortBy?: 'createdAt' | 'reward' | 'updatedAt';
  /** Sort direction */
  sortDir?: 'asc' | 'desc';
}

/**
 * Options for filtering contributor list queries.
 */
export interface ContributorListOptions {
  /** Filter by tier */
  tier?: ContributorTier;
  /** Search by handle or display name */
  search?: string;
  /** Page number */
  page?: number;
  /** Items per page */
  pageSize?: number;
  /** Sort by field */
  sortBy?: 'reputationScore' | 'totalEarned' | 'completedBounties' | 'registeredAt';
  /** Sort direction */
  sortDir?: 'asc' | 'desc';
}

/**
 * SDK configuration options.
 */
export interface SolFoundryClientConfig {
  /**
   * Base URL of the SolFoundry API.
   * Defaults to https://api.solfoundry.io
   */
  apiBaseUrl?: string;
  /**
   * Authentication token (JWT from GitHub OAuth or wallet signing).
   * Required for write operations (submitWork, claimBounty).
   */
  authToken?: string;
  /**
   * Request timeout in milliseconds. Defaults to 10000 (10s).
   */
  timeoutMs?: number;
  /**
   * Number of automatic retries on 5xx errors. Defaults to 2.
   */
  retries?: number;
}

/**
 * API error thrown when the server returns a non-2xx response.
 */
export class SolFoundryApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly errorCode: string,
    message: string,
  ) {
    super(`SolFoundry API Error [${statusCode}] ${errorCode}: ${message}`);
    this.name = 'SolFoundryApiError';
  }
}
