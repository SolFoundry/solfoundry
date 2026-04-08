/**
 * SolFoundry TypeScript SDK — Core Client Library.
 *
 * This is the primary way developers integrate with SolFoundry's
 * on-chain programs and REST APIs. The SDK provides:
 *
 * - **Bounty operations**: CRUD, search, submissions, autocomplete
 * - **Escrow management**: Fund, release, refund, audit ledger
 * - **Contributor profiles**: Create, update, list, stats
 * - **GitHub integration**: List bounties, check claims, verify completion
 * - **Solana helpers**: PDA derivation, account deserialization, tx building
 * - **Real-time events**: WebSocket subscriptions with auto-reconnect
 * - **Error handling**: Typed error hierarchy matching backend exceptions
 * - **Connection management**: Retry logic, rate limiting, timeout handling
 *
 * @example
 * ```typescript
 * import { SolFoundry } from '@solfoundry/sdk';
 *
 * const client = SolFoundry.create({
 *   baseUrl: 'https://api.solfoundry.io',
 *   authToken: 'your-jwt-token',
 * });
 *
 * // List open bounties
 * const bounties = await client.bounties.list({ status: 'open' });
 *
 * // Get Solana balances
 * const balance = await client.solana.getTokenBalance(walletPubkey);
 * ```
 *
 * @packageDocumentation
 */

// Core client
export { HttpClient, RateLimiter, buildUrl, calculateBackoff, isRetryable } from './client.js';
export type { RequestOptions } from './client.js';

// Resource clients
export { BountyClient } from './bounties.js';
export { EscrowClient } from './escrow.js';
export { ContributorClient } from './contributors.js';
export { GitHubClient } from './github.js';
export type { GitHubClientConfig } from './github.js';
export { EventSubscriber } from './events.js';
export type { EventSubscriberConfig, EventHandler, ConnectionHandler, ErrorHandler } from './events.js';
export {
  MarketplaceApiClient,
  MarketplaceBountiesClient,
  MarketplaceSubmissionsClient,
  UsersClient,
} from './rest-api.js';
export type {
  MarketplaceBountyStatus,
  MarketplaceBountyTier,
  RewardToken,
  MarketplaceSubmissionStatus,
  UserRole,
  MarketplaceBounty,
  MarketplaceBountyCreate,
  MarketplaceBountiesListParams,
  MarketplaceBountiesListResponse,
  MarketplaceSubmission,
  MarketplaceSubmissionCreate,
  UserProfile,
  UserProfileUpdate,
} from './rest-types.js';

// Solana helpers
export {
  FNDRY_TOKEN_MINT,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TREASURY_WALLET,
  DEFAULT_RPC_ENDPOINT,
  FNDRY_DECIMALS,
  findAssociatedTokenAddress,
  findProgramAddress,
  findEscrowAddress,
  findReputationAddress,
  getSolBalance,
  getTokenBalance,
  buildTokenTransferInstruction,
  buildTokenTransferTransaction,
  createConnection,
  isValidSolanaAddress,
  toRawAmount,
  toUiAmount,
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
} from './solana.js';
export type { SolBalance, TokenBalance } from './solana.js';

// Error hierarchy
export {
  SolFoundryError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  LockError,
  RateLimitError,
  UpstreamError,
  ServerError,
  NetworkError,
  RetryExhaustedError,
} from './errors.js';

// Types (re-export everything)
export type {
  // Enums
  BountyTier,
  BountyStatus,
  SubmissionStatus,
  EscrowState,
  LedgerAction,
  // Bounty types
  BountyCreate,
  BountyUpdate,
  BountyResponse,
  BountyListItem,
  BountyListResponse,
  // Submission types
  SubmissionCreate,
  SubmissionResponse,
  SubmissionStatusUpdate,
  // Search types
  BountySearchSort,
  BountyCategory,
  BountySearchParams,
  BountySearchResult,
  BountySearchResponse,
  AutocompleteItem,
  AutocompleteResponse,
  // Escrow types
  EscrowFundRequest,
  EscrowReleaseRequest,
  EscrowRefundRequest,
  EscrowResponse,
  EscrowLedgerEntry,
  EscrowStatusResponse,
  // Contributor types
  ContributorCreate,
  ContributorUpdate,
  ContributorResponse,
  ContributorListResponse,
  // Stats types
  TierStats,
  TopContributor,
  StatsResponse,
  // Health types
  ServiceHealth,
  HealthResponse,
  // GitHub types
  GitHubBountyIssue,
  GitHubPullRequest,
  // WebSocket types
  WebSocketEventType,
  WebSocketEvent,
  // Config types
  SolFoundryClientConfig,
  ApiErrorResponse,
} from './types.js';

// Program clients (on-chain Anchor program interaction)
export {
  BaseClient,
  BountyRegistryClient,
  StakingClient,
  EscrowProgramClient,
  ReputationClient,
  TreasuryClient,
} from './programs/index.js';
export type {
  ProgramClientConfig,
  EscrowProgramClientConfig,
  ReputationClientConfig,
  TreasuryClientConfig,
} from './programs/index.js';

// ---------------------------------------------------------------------------
// Convenience factory
// ---------------------------------------------------------------------------

import { HttpClient } from './client.js';
import { BountyClient } from './bounties.js';
import { EscrowClient } from './escrow.js';
import { ContributorClient } from './contributors.js';
import { MarketplaceApiClient } from './rest-api.js';
import type { SolFoundryClientConfig } from './types.js';

/**
 * Unified facade providing access to all SolFoundry SDK resource clients
 * from a single entry point.
 *
 * This is the recommended way to use the SDK. Create an instance with
 * {@link SolFoundry.create} and access resource-specific methods through
 * the `bounties`, `escrow`, and `contributors` properties.
 *
 * @example
 * ```typescript
 * const sf = SolFoundry.create({
 *   baseUrl: 'https://api.solfoundry.io',
 *   authToken: 'eyJ...',
 * });
 *
 * // Access bounty operations
 * const list = await sf.bounties.list({ status: 'open' });
 *
 * // Access escrow operations
 * const escrow = await sf.escrow.getStatus('bounty-uuid');
 *
 * // Access contributor operations
 * const stats = await sf.contributors.getStats();
 * ```
 */
export class SolFoundry {
  /** The underlying HTTP client used for all API requests. */
  public readonly http: HttpClient;

  /** Client for bounty CRUD, search, and submission operations. */
  public readonly bounties: BountyClient;

  /** Client for escrow lifecycle management. */
  public readonly escrow: EscrowClient;

  /** Client for contributor profiles and platform statistics. */
  public readonly contributors: ContributorClient;

  /** Combined typed REST API client for bounties, submissions, and users. */
  public readonly api: MarketplaceApiClient;

  /**
   * Create a SolFoundry SDK instance with the given configuration.
   *
   * @param config - Client configuration (base URL, auth, retry settings).
   */
  private constructor(config: SolFoundryClientConfig) {
    this.http = new HttpClient(config);
    this.bounties = new BountyClient(this.http);
    this.escrow = new EscrowClient(this.http);
    this.contributors = new ContributorClient(this.http);
    this.api = new MarketplaceApiClient(this.http);
  }

  /**
   * Factory method to create a new SolFoundry SDK instance.
   *
   * @param config - Client configuration including base URL, optional auth token,
   *   RPC endpoint, timeout, retry, and rate limit settings.
   * @returns A fully configured SolFoundry SDK instance.
   */
  static create(config: SolFoundryClientConfig): SolFoundry {
    return new SolFoundry(config);
  }

  /**
   * Update the authentication token for all subsequent API requests.
   *
   * Call this after obtaining a new JWT through GitHub OAuth or
   * Solana wallet authentication.
   *
   * @param token - The new JWT bearer token, or undefined to clear auth.
   */
  setAuthToken(token: string | undefined): void {
    this.http.setAuthToken(token);
  }
}
