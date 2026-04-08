import type {
  AuthTokens,
  User,
  Bounty,
  ListBountiesParams,
  BountyCreatePayload,
  Submission,
  SubmissionCreatePayload,
  PaginatedResponse,
  TreasuryDepositInfo,
  EscrowVerifyPayload,
  EscrowVerifyResult,
  ReviewFeeInfo,
  ReviewFeeVerifyPayload,
  ReviewFeeVerifyResult,
  LeaderboardEntry,
  TimePeriod,
  PlatformStats,
} from '../types/index';
import { SolFoundryError } from '../utils/error';
import { RateLimiter, retryWithBackoff } from '../utils/rate-limiter';

/** Configuration options for the SolFoundry client */
export interface SolFoundryConfig {
  /** Base URL of the SolFoundry API (default: https://solfoundry.com) */
  baseUrl?: string;
  /** JWT access token for authenticated requests */
  accessToken?: string;
  /** Refresh token for automatic token renewal */
  refreshToken?: string;
  /** Callback invoked when tokens are refreshed */
  onTokensRefreshed?: (tokens: AuthTokens) => void;
  /** Maximum requests per second (default: 10) */
  maxRequestsPerSecond?: number;
  /** Maximum retry attempts for retryable errors (default: 3) */
  maxRetries?: number;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
}

interface ApiResponse<T> {
  data: T;
}

/** Internal token state */
interface TokenState {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

/**
 * SolFoundry API Client
 *
 * Provides full access to the SolFoundry bounty platform API including
 * authentication, bounty management, submissions, treasury/escrow,
 * review fees, leaderboard, and platform statistics.
 *
 * @example
 * ```typescript
 * import { SolFoundryClient } from '@solfoundry/sdk';
 *
 * const client = new SolFoundryClient({
 *   accessToken: 'your-jwt-token',
 * });
 *
 * const bounties = await client.bounties.list({ status: 'open', limit: 10 });
 * ```
 */
export class SolFoundryClient {
  private readonly baseUrl: string;
  private readonly rateLimiter: RateLimiter;
  private readonly maxRetries: number;
  private readonly timeout: number;
  private readonly onTokensRefreshed?: (tokens: AuthTokens) => void;
  private tokenState: TokenState;

  /** Auth API methods */
  public readonly auth: AuthAPI;
  /** Bounties API methods */
  public readonly bounties: BountiesAPI;
  /** Treasury/Escrow API methods */
  public readonly treasury: TreasuryAPI;
  /** Review Fee API methods */
  public readonly reviewFee: ReviewFeeAPI;
  /** Leaderboard API methods */
  public readonly leaderboard: LeaderboardAPI;
  /** Platform Stats API methods */
  public readonly stats: StatsAPI;

  constructor(config: SolFoundryConfig = {}) {
    this.baseUrl = (config.baseUrl || 'https://solfoundry.com').replace(/\/+$/, '');
    this.maxRetries = config.maxRetries ?? 3;
    this.timeout = config.timeout ?? 30000;
    this.onTokensRefreshed = config.onTokensRefreshed;
    this.rateLimiter = new RateLimiter(config.maxRequestsPerSecond ?? 10);
    this.tokenState = {
      accessToken: config.accessToken,
      refreshToken: config.refreshToken,
    };

    // Initialize API namespaces
    this.auth = new AuthAPI(this);
    this.bounties = new BountiesAPI(this);
    this.treasury = new TreasuryAPI(this);
    this.reviewFee = new ReviewFeeAPI(this);
    this.leaderboard = new LeaderboardAPI(this);
    this.stats = new StatsAPI(this);
  }

  /** Update the access token (e.g., after manual refresh) */
  setAccessToken(token: string): void {
    this.tokenState.accessToken = token;
  }

  /** Get the current access token */
  getAccessToken(): string | undefined {
    return this.tokenState.accessToken;
  }

  /**
   * Core request method with rate limiting, retry, and auto-refresh.
   * @internal
   */
  async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    options: {
      body?: unknown;
      params?: Record<string, string | number | boolean | undefined>;
      auth?: boolean;
      noRetry?: boolean;
    } = {},
  ): Promise<T> {
    const { body, params, auth = true, noRetry = false } = options;

    return retryWithBackoff(
      async () => {
        await this.rateLimiter.acquire();

        const url = new URL(`${this.baseUrl}${path}`);
        if (params) {
          for (const [key, value] of Object.entries(params)) {
            if (value !== undefined) {
              url.searchParams.set(key, String(value));
            }
          }
        }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        };

        if (auth && this.tokenState.accessToken) {
          headers['Authorization'] = `Bearer ${this.tokenState.accessToken}`;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
          const response = await fetch(url.toString(), {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          // Auto-refresh on 401
          if (response.status === 401 && this.tokenState.refreshToken && !noRetry) {
            try {
              const tokens = await this.auth.refreshTokens(this.tokenState.refreshToken);
              this.tokenState.accessToken = tokens.accessToken;
              this.tokenState.refreshToken = tokens.refreshToken;
              this.onTokensRefreshed?.(tokens);
              // Retry the request with new token (noRetry to avoid infinite loop)
              return this.request<T>(method, path, { ...options, noRetry: true });
            } catch {
              // Refresh failed, throw original 401
            }
          }

          if (!response.ok) {
            let errorBody: Record<string, unknown> = {};
            try {
              errorBody = await response.json();
            } catch {
              // ignore json parse error
            }
            throw new SolFoundryError(
              (errorBody.message as string) || `HTTP ${response.status}`,
              response.status,
              (errorBody.code as string) || 'UNKNOWN_ERROR',
              errorBody.details as Record<string, unknown> | undefined,
            );
          }

          // Handle 204 No Content
          if (response.status === 204) {
            return undefined as T;
          }

          const json = await response.json();
          return (json.data !== undefined ? json.data : json) as T;
        } catch (error) {
          clearTimeout(timeoutId);
          if (error instanceof SolFoundryError) throw error;
          if ((error as Error).name === 'AbortError') {
            throw new SolFoundryError('Request timed out', 0, 'TIMEOUT');
          }
          throw new SolFoundryError(
            (error as Error).message || 'Network error',
            0,
            'NETWORK_ERROR',
          );
        }
      },
      {
        maxRetries: noRetry ? 0 : this.maxRetries,
        retryableCheck: (error) =>
          error instanceof SolFoundryError && error.isRetryable,
      },
    );
  }
}

// ─── Auth API ────────────────────────────────────────────────────────────────

/** Authentication API */
export class AuthAPI {
  constructor(private readonly client: SolFoundryClient) {}

  /**
   * Get the GitHub OAuth authorize URL.
   * Redirect users to this URL to start the GitHub OAuth flow.
   *
   * @example
   * ```typescript
   * const url = client.auth.getGitHubAuthorizeUrl();
   * // Redirect user to url
   * ```
   */
  async getGitHubAuthorizeUrl(): Promise<string> {
    const result = await this.client.request<{ url: string }>(
      'GET',
      '/api/auth/github/authorize',
      { auth: false },
    );
    return result.url;
  }

  /**
   * Exchange a GitHub OAuth code for access tokens.
   *
   * @param code - The authorization code from GitHub OAuth callback
   * @param state - Optional state parameter for CSRF protection
   *
   * @example
   * ```typescript
   * const tokens = await client.auth.exchangeGitHubCode('oauth-code-from-callback');
   * console.log(tokens.accessToken);
   * ```
   */
  async exchangeGitHubCode(code: string, state?: string): Promise<AuthTokens> {
    return this.client.request<AuthTokens>('POST', '/api/auth/github', {
      body: { code, state },
      auth: false,
    });
  }

  /**
   * Get the authenticated user's profile.
   *
   * @example
   * ```typescript
   * const me = await client.auth.getMe();
   * console.log(me.githubUsername);
   * ```
   */
  async getMe(): Promise<User> {
    return this.client.request<User>('GET', '/api/auth/me');
  }

  /**
   * Refresh an expired access token using a refresh token.
   *
   * @param refreshToken - The refresh token to exchange
   *
   * @example
   * ```typescript
   * const newTokens = await client.auth.refreshTokens('your-refresh-token');
   * ```
   */
  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    return this.client.request<AuthTokens>('POST', '/api/auth/refresh', {
      body: { refreshToken },
      auth: false,
      noRetry: true,
    });
  }
}

// ─── Bounties API ────────────────────────────────────────────────────────────

/** Bounties API */
export class BountiesAPI {
  constructor(private readonly client: SolFoundryClient) {}

  /**
   * List bounties with optional filters and pagination.
   *
   * @param params - Filter and pagination options
   * @returns Paginated list of bounties
   *
   * @example
   * ```typescript
   * // Get open T3 bounties
   * const result = await client.bounties.list({
   *   status: 'open',
   *   tier: 'T3',
   *   limit: 10,
   * });
   * for (const bounty of result.data) {
   *   console.log(`${bounty.title} - ${bounty.reward.amount} ${bounty.reward.token}`);
   * }
   * ```
   */
  async list(params?: ListBountiesParams): Promise<PaginatedResponse<Bounty>> {
    const queryParams: Record<string, string | number | boolean | undefined> = {};
    if (params?.status) queryParams.status = params.status;
    if (params?.limit) queryParams.limit = params.limit;
    if (params?.offset) queryParams.offset = params.offset;
    if (params?.skill) queryParams.skill = params.skill;
    if (params?.tier) queryParams.tier = params.tier;
    if (params?.reward_token) queryParams.reward_token = params.reward_token;

    return this.client.request<PaginatedResponse<Bounty>>('GET', '/api/bounties', {
      params: queryParams,
      auth: false,
    });
  }

  /**
   * Get a single bounty by ID.
   *
   * @param id - Bounty ID
   *
   * @example
   * ```typescript
   * const bounty = await client.bounties.get('bounty-123');
   * console.log(bounty.title, bounty.status);
   * ```
   */
  async get(id: string): Promise<Bounty> {
    return this.client.request<Bounty>('GET', `/api/bounties/${id}`, { auth: false });
  }

  /**
   * Create a new bounty. Requires authentication.
   *
   * @param payload - Bounty creation data
   *
   * @example
   * ```typescript
   * const bounty = await client.bounties.create({
   *   title: 'Build a TypeScript SDK',
   *   description: 'Create a comprehensive SDK...',
   *   tier: 'T3',
   *   rewardToken: 'FNDRY',
   *   rewardAmount: '900000',
   *   skills: ['typescript', 'sdk', 'api-design'],
   *   deadline: '2025-12-31T23:59:59Z',
   * });
   * ```
   */
  async create(payload: BountyCreatePayload): Promise<Bounty> {
    return this.client.request<Bounty>('POST', '/api/bounties', { body: payload });
  }

  /**
   * List submissions for a bounty.
   *
   * @param bountyId - The bounty ID
   *
   * @example
   * ```typescript
   * const submissions = await client.bounties.listSubmissions('bounty-123');
   * for (const sub of submissions.data) {
   *   console.log(`${sub.title} - ${sub.status}`);
   * }
   * ```
   */
  async listSubmissions(bountyId: string): Promise<PaginatedResponse<Submission>> {
    return this.client.request<PaginatedResponse<Submission>>(
      'GET',
      `/api/bounties/${bountyId}/submissions`,
      { auth: false },
    );
  }

  /**
   * Submit work to a bounty. Requires authentication.
   *
   * @param bountyId - The bounty ID
   * @param payload - Submission data
   *
   * @example
   * ```typescript
   * const submission = await client.bounties.createSubmission('bounty-123', {
   *   title: 'My Implementation',
   *   description: 'I implemented the SDK with full API coverage...',
   *   links: ['https://github.com/user/repo/pull/1'],
   * });
   * ```
   */
  async createSubmission(bountyId: string, payload: SubmissionCreatePayload): Promise<Submission> {
    return this.client.request<Submission>(
      'POST',
      `/api/bounties/${bountyId}/submissions`,
      { body: payload },
    );
  }
}

// ─── Treasury/Escrow API ────────────────────────────────────────────────────

/** Treasury and Escrow API */
export class TreasuryAPI {
  constructor(private readonly client: SolFoundryClient) {}

  /**
   * Get treasury deposit information for funding a bounty escrow.
   *
   * @param bountyId - The bounty ID to fund
   *
   * @example
   * ```typescript
   * const depositInfo = await client.treasury.getTreasuryDepositInfo('bounty-123');
   * // Send `depositInfo.amount` of `depositInfo.token` to `depositInfo.walletAddress`
   * // with `depositInfo.memo` as the transaction memo
   * ```
   */
  async getTreasuryDepositInfo(bountyId: string): Promise<TreasuryDepositInfo> {
    return this.client.request<TreasuryDepositInfo>('GET', '/api/treasury/deposit-info', {
      params: { bountyId },
    });
  }

  /**
   * Verify that an escrow deposit has been received on-chain.
   *
   * @param payload - Escrow verification data with transaction signature
   *
   * @example
   * ```typescript
   * const result = await client.treasury.verifyEscrowDeposit({
   *   bountyId: 'bounty-123',
   *   transactionSignature: '5Kt...sig',
   * });
   * if (result.verified) console.log('Deposit confirmed!');
   * ```
   */
  async verifyEscrowDeposit(payload: EscrowVerifyPayload): Promise<EscrowVerifyResult> {
    return this.client.request<EscrowVerifyResult>('POST', '/api/escrow/verify-deposit', {
      body: payload,
    });
  }
}

// ─── Review Fee API ──────────────────────────────────────────────────────────

/** Review Fee API */
export class ReviewFeeAPI {
  constructor(private readonly client: SolFoundryClient) {}

  /**
   * Get the review fee details for a bounty.
   *
   * @param bountyId - The bounty ID
   *
   * @example
   * ```typescript
   * const fee = await client.reviewFee.getReviewFee('bounty-123');
   * console.log(`Review fee: ${fee.amount} ${fee.token}`);
   * ```
   */
  async getReviewFee(bountyId: string): Promise<ReviewFeeInfo> {
    return this.client.request<ReviewFeeInfo>('GET', `/api/review-fee/${bountyId}`);
  }

  /**
   * Verify that a review fee payment has been made on-chain.
   *
   * @param payload - Verification data with transaction signature
   *
   * @example
   * ```typescript
   * const result = await client.reviewFee.verify({
   *   bountyId: 'bounty-123',
   *   transactionSignature: '5Kt...sig',
   * });
   * ```
   */
  async verify(payload: ReviewFeeVerifyPayload): Promise<ReviewFeeVerifyResult> {
    return this.client.request<ReviewFeeVerifyResult>('POST', '/api/review-fee/verify', {
      body: payload,
    });
  }
}

// ─── Leaderboard API ─────────────────────────────────────────────────────────

/** Leaderboard API */
export class LeaderboardAPI {
  constructor(private readonly client: SolFoundryClient) {}

  /**
   * Get the leaderboard rankings.
   *
   * @param period - Time period filter (default: 'all_time')
   *
   * @example
   * ```typescript
   * const topHunters = await client.leaderboard.get('monthly');
   * for (const entry of topHunters.data) {
   *   console.log(`#${entry.rank} ${entry.name} - $${entry.totalEarnings}`);
   * }
   * ```
   */
  async get(period?: TimePeriod): Promise<PaginatedResponse<LeaderboardEntry>> {
    return this.client.request<PaginatedResponse<LeaderboardEntry>>(
      'GET',
      '/api/leaderboard',
      { params: { period }, auth: false },
    );
  }
}

// ─── Stats API ───────────────────────────────────────────────────────────────

/** Platform Statistics API */
export class StatsAPI {
  constructor(private readonly client: SolFoundryClient) {}

  /**
   * Get platform-wide statistics.
   *
   * @example
   * ```typescript
   * const stats = await client.stats.get();
   * console.log(`${stats.openBounties} open bounties worth $${stats.totalDistributed}`);
   * ```
   */
  async get(): Promise<PlatformStats> {
    return this.client.request<PlatformStats>('GET', '/api/stats', { auth: false });
  }
}
