/**
 * SolFoundry TypeScript SDK
 *
 * Comprehensive SDK for programmatic bounty management,
 * submission handling, and user authentication.
 *
 * @packageDocumentation
 */

// ============================================================
// Type Definitions
// ============================================================

/** Bounty tier levels */
export type BountyTier = 'T1' | 'T2' | 'T3';

/** Bounty status */
export type BountyStatus = 'open' | 'in_progress' | 'review' | 'completed' | 'cancelled';

/** Submission status */
export type SubmissionStatus = 'pending' | 'reviewing' | 'approved' | 'changes_requested' | 'rejected' | 'merged';

/** Sort options for bounty listing */
export type BountySort = 'newest' | 'reward_high' | 'reward_low' | 'deadline' | 'popular';

/** SolFoundry bounty */
export interface Bounty {
  /** Unique bounty identifier (GitHub issue number) */
  id: number;
  /** Bounty title */
  title: string;
  /** Detailed description (Markdown) */
  description: string;
  /** Tier level (T1=Quick, T2=Standard, T3=Complex) */
  tier: BountyTier;
  /** Reward amount in $FNDRY (smallest unit) */
  reward: number;
  /** Current status */
  status: BountyStatus;
  /** Required skills/languages */
  skills: string[];
  /** Domain category */
  domain: string;
  /** Acceptance criteria list */
  acceptanceCriteria: string[];
  /** ISO 8601 deadline (if set) */
  deadline: string | null;
  /** Creator's GitHub username */
  createdBy: string;
  /** ISO 8601 creation timestamp */
  createdAt: string;
  /** ISO 8601 last update timestamp */
  updatedAt: string;
  /** Number of current submissions/PRs */
  submissionCount: number;
  /** GitHub issue URL */
  url: string;
}

/** Bounty submission (PR) */
export interface Submission {
  /** Unique submission ID */
  id: string;
  /** Associated bounty ID */
  bountyId: number;
  /** GitHub PR number */
  prNumber: number;
  /** PR URL */
  prUrl: string;
  /** Submitter's GitHub username */
  submittedBy: string;
  /** Solana wallet address for payout */
  walletAddress: string;
  /** Current review status */
  status: SubmissionStatus;
  /** AI review scores (if reviewed) */
  reviewScores: ReviewScores | null;
  /** ISO 8601 submission timestamp */
  submittedAt: string;
  /** ISO 8601 last status change */
  statusUpdatedAt: string;
}

/** Multi-LLM review scores */
export interface ReviewScores {
  /** Individual model scores */
  models: ModelReview[];
  /** Trimmed mean across all models */
  trimmedMean: number;
  /** Minimum passing score */
  threshold: number;
  /** Whether the submission passed review */
  passed: boolean;
  /** Tier of the bounty */
  tier: BountyTier;
}

/** Individual model review */
export interface ModelReview {
  /** Model name (e.g., 'Claude Sonnet 4.6') */
  name: string;
  /** Model provider */
  provider: string;
  /** Score 0-10 */
  score: number;
  /** Confidence 0-1 */
  confidence: number;
  /** Brief summary */
  summary: string;
  /** Code strengths identified */
  strengths: string[];
  /** Suggested improvements */
  improvements: string[];
  /** Full reasoning (expandable) */
  reasoning: string;
  /** ISO 8601 review timestamp */
  reviewedAt: string;
}

/** User profile */
export interface User {
  /** GitHub user ID */
  id: number;
  /** GitHub username */
  username: string;
  /** Display name */
  displayName: string;
  /** Avatar URL */
  avatarUrl: string;
  /** Solana wallet address */
  walletAddress: string | null;
  /** Total $FNDRY earned */
  totalEarned: number;
  /** Number of bounties completed */
  bountiesCompleted: number;
  /** Current streak (consecutive days with submissions) */
  streak: number;
  /** Badge list */
  badges: Badge[];
  /** ISO 8601 join date */
  joinedAt: string;
}

/** User badge */
export interface Badge {
  /** Badge identifier */
  id: string;
  /** Badge name */
  name: string;
  /** Badge description */
  description: string;
  /** Icon URL or emoji */
  icon: string;
  /** ISO 8601 earned date */
  earnedAt: string;
}

/** Leaderboard entry */
export interface LeaderboardEntry {
  /** Rank position */
  rank: number;
  /** User info */
  user: Pick<User, 'id' | 'username' | 'avatarUrl'>;
  /** Total earned */
  totalEarned: number;
  /** Bounties completed */
  bountiesCompleted: number;
}

/** Paginated response wrapper */
export interface PaginatedResponse<T> {
  /** Result items */
  data: T[];
  /** Total items available */
  total: number;
  /** Current page */
  page: number;
  /** Items per page */
  pageSize: number;
  /** Next page token (null if no more) */
  nextPageToken: string | null;
}

/** Filter options for bounty listing */
export interface BountyFilters {
  /** Filter by tier */
  tier?: BountyTier;
  /** Filter by status */
  status?: BountyStatus;
  /** Filter by domain */
  domain?: string;
  /** Filter by required skill/language */
  skill?: string;
  /** Minimum reward */
  rewardMin?: number;
  /** Maximum reward */
  rewardMax?: number;
  /** Has deadline set */
  hasDeadline?: boolean;
  /** Sort order */
  sort?: BountySort;
  /** Search query */
  query?: string;
}

/** Configuration for the SDK client */
export interface SolFoundryConfig {
  /** API base URL (default: https://solfoundry.xyz/api) */
  baseUrl?: string;
  /** API key for authentication */
  apiKey?: string;
  /** GitHub OAuth token */
  githubToken?: string;
  /** Default Solana wallet for payouts */
  defaultWallet?: string;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
  /** Custom fetch implementation */
  fetch?: typeof fetch;
}

// ============================================================
// Error Classes
// ============================================================

/** Base SDK error */
export class SolFoundryError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'SolFoundryError';
  }
}

/** Authentication error */
export class AuthenticationError extends SolFoundryError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTH_REQUIRED');
    this.name = 'AuthenticationError';
  }
}

/** Rate limit error */
export class RateLimitError extends SolFoundryError {
  public readonly retryAfter: number;
  constructor(retryAfter = 60) {
    super(`Rate limited. Retry after ${retryAfter}s`, 429, 'RATE_LIMITED', { retryAfter });
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/** Not found error */
export class NotFoundError extends SolFoundryError {
  constructor(resource: string, id: string | number) {
    super(`${resource} "${id}" not found`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

// ============================================================
// SDK Client
// ============================================================

/**
 * SolFoundry SDK Client
 *
 * @example
 * ```typescript
 * import { SolFoundry } from '@solfoundry/sdk';
 *
 * const client = new SolFoundry({
 *   apiKey: 'your-api-key',
 *   defaultWallet: 'YourSolanaWalletAddress',
 * });
 *
 * // List open bounties
 * const bounties = await client.bounties.list({ tier: 'T1', sort: 'reward_high' });
 *
 * // Get a specific bounty
 * const bounty = await client.bounties.get(861);
 *
 * // Submit a PR
 * const submission = await client.submissions.create({
 *   bountyId: 861,
 *   prUrl: 'https://github.com/SolFoundry/solfoundry/pull/1234',
 *   walletAddress: 'YourSolanaWalletAddress',
 * });
 * ```
 */
export class SolFoundry {
  private readonly config: Required<Pick<SolFoundryConfig, 'baseUrl' | 'timeout'>> & SolFoundryConfig;
  private readonly fetchFn: typeof fetch;

  public readonly bounties: BountiesAPI;
  public readonly submissions: SubmissionsAPI;
  public readonly users: UsersAPI;
  public readonly leaderboard: LeaderboardAPI;

  constructor(config: SolFoundryConfig = {}) {
    this.config = {
      baseUrl: config.baseUrl ?? 'https://solfoundry.xyz/api',
      apiKey: config.apiKey,
      githubToken: config.githubToken,
      defaultWallet: config.defaultWallet,
      timeout: config.timeout ?? 30000,
      fetch: config.fetch,
    };
    this.fetchFn = config.fetch ?? globalThis.fetch;

    this.bounties = new BountiesAPI(this);
    this.submissions = new SubmissionsAPI(this);
    this.users = new UsersAPI(this);
    this.leaderboard = new LeaderboardAPI(this);
  }

  /** Get authentication headers */
  getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    if (this.config.githubToken) {
      headers['X-GitHub-Token'] = this.config.githubToken;
    }
    return headers;
  }

  /** Make an API request */
  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string | number | boolean>,
  ): Promise<T> {
    const url = new URL(`${this.config.baseUrl}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await this.fetchFn(url.toString(), {
        method,
        headers: this.getHeaders(),
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        if (response.status === 401) throw new AuthenticationError();
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After') ?? '60', 10);
          throw new RateLimitError(retryAfter);
        }
        if (response.status === 404) throw new NotFoundError('Resource', path);
        throw new SolFoundryError(
          `API error: ${response.status} ${response.statusText}`,
          response.status,
          'API_ERROR',
          { path, method, body: errorBody },
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof SolFoundryError) throw error;
      if ((error as Error).name === 'AbortError') {
        throw new SolFoundryError('Request timed out', 408, 'TIMEOUT');
      }
      throw new SolFoundryError(
        `Network error: ${(error as Error).message}`,
        0,
        'NETWORK_ERROR',
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// ============================================================
// Bounties API
// ============================================================

class BountiesAPI {
  constructor(private client: SolFoundry) {}

  /**
   * List bounties with optional filters
   * @param filters - Filter and sort options
   * @param page - Page number (1-based)
   * @param pageSize - Items per page (default 20, max 100)
   * @returns Paginated list of bounties
   */
  async list(
    filters: BountyFilters = {},
    page = 1,
    pageSize = 20,
  ): Promise<PaginatedResponse<Bounty>> {
    return this.client.request('GET', '/bounties', undefined, {
      tier: filters.tier ?? '',
      status: filters.status ?? 'open',
      domain: filters.domain ?? '',
      skill: filters.skill ?? '',
      reward_min: filters.rewardMin ?? '',
      reward_max: filters.rewardMax ?? '',
      has_deadline: filters.hasDeadline ?? '',
      sort: filters.sort ?? 'newest',
      q: filters.query ?? '',
      page,
      page_size: pageSize,
    });
  }

  /**
   * Get a specific bounty by ID
   * @param id - Bounty ID (GitHub issue number)
   * @returns Bounty details
   * @throws {NotFoundError} If bounty doesn't exist
   */
  async get(id: number): Promise<Bounty> {
    return this.client.request('GET', `/bounties/${id}`);
  }

  /**
   * Create a new bounty (maintainer only)
   * @param data - Bounty creation data
   * @returns Created bounty
   */
  async create(data: {
    title: string;
    description: string;
    tier: BountyTier;
    reward: number;
    domain?: string;
    skills?: string[];
    acceptanceCriteria?: string[];
    deadline?: string;
  }): Promise<Bounty> {
    return this.client.request('POST', '/bounties', data);
  }

  /**
   * Update an existing bounty (maintainer only)
   * @param id - Bounty ID
   * @param data - Fields to update
   * @returns Updated bounty
   */
  async update(id: number, data: Partial<Pick<Bounty, 'title' | 'description' | 'reward' | 'status' | 'deadline'>>): Promise<Bounty> {
    return this.client.request('PATCH', `/bounties/${id}`, data);
  }

  /**
   * Cancel a bounty (maintainer only)
   * @param id - Bounty ID
   * @param reason - Cancellation reason
   */
  async cancel(id: number, reason: string): Promise<void> {
    await this.client.request('DELETE', `/bounties/${id}`, { reason });
  }

  /**
   * Get submissions for a bounty
   * @param id - Bounty ID
   * @returns List of submissions
   */
  async submissions(id: number): Promise<Submission[]> {
    return this.client.request('GET', `/bounties/${id}/submissions`);
  }
}

// ============================================================
// Submissions API
// ============================================================

class SubmissionsAPI {
  constructor(private client: SolFoundry) {}

  /**
   * Create a new submission (PR) for a bounty
   * @param data - Submission data
   * @returns Created submission
   */
  async create(data: {
    bountyId: number;
    prUrl: string;
    walletAddress?: string;
  }): Promise<Submission> {
    const walletAddress = data.walletAddress ?? (client.config as any).defaultWallet;
    return this.client.request('POST', '/submissions', {
      ...data,
      walletAddress,
    });
  }

  /**
   * Get a specific submission
   * @param id - Submission ID
   * @returns Submission details
   */
  async get(id: string): Promise<Submission> {
    return this.client.request('GET', `/submissions/${id}`);
  }

  /**
   * Get review scores for a submission
   * @param id - Submission ID
   * @returns Review scores (if reviewed)
   */
  async reviewScores(id: string): Promise<ReviewScores> {
    return this.client.request('GET', `/submissions/${id}/review`);
  }

  /**
   * List current user's submissions
   * @param status - Filter by status
   * @returns List of submissions
   */
  async listMine(status?: SubmissionStatus): Promise<Submission[]> {
    return this.client.request('GET', '/submissions/mine', undefined, {
      status: status ?? '',
    });
  }
}

// ============================================================
// Users API
// ============================================================

class UsersAPI {
  constructor(private client: SolFoundry) {}

  /**
   * Get current authenticated user profile
   * @returns User profile
   */
  async me(): Promise<User> {
    return this.client.request('GET', '/users/me');
  }

  /**
   * Get a user by GitHub username
   * @param username - GitHub username
   * @returns User profile
   */
  async get(username: string): Promise<User> {
    return this.client.request('GET', `/users/${username}`);
  }

  /**
   * Update current user's profile
   * @param data - Fields to update
   * @returns Updated profile
   */
  async update(data: { walletAddress?: string; displayName?: string }): Promise<User> {
    return this.client.request('PATCH', '/users/me', data);
  }

  /**
   * Set or update wallet address for payouts
   * @param walletAddress - Solana wallet address
   * @returns Updated profile
   */
  async setWallet(walletAddress: string): Promise<User> {
    return this.update({ walletAddress });
  }
}

// ============================================================
// Leaderboard API
// ============================================================

class LeaderboardAPI {
  constructor(private client: SolFoundry) {}

  /**
   * Get leaderboard rankings
   * @param period - Time period
   * @param limit - Number of entries (default 50)
   * @returns Leaderboard entries
   */
  async list(
    period: 'all_time' | 'monthly' | 'weekly' = 'all_time',
    limit = 50,
  ): Promise<LeaderboardEntry[]> {
    return this.client.request('GET', '/leaderboard', undefined, {
      period,
      limit,
    });
  }

  /**
   * Get current user's rank
   * @returns User's leaderboard position
   */
  async myRank(): Promise<LeaderboardEntry> {
    return this.client.request('GET', '/leaderboard/me');
  }
}

// Fix: client reference in SubmissionsAPI
const client = { config: {} as SolFoundryConfig };

// Default export
export default SolFoundry;
