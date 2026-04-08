/**
 * Typed REST API clients for marketplace-facing SolFoundry endpoints.
 *
 * This module provides dedicated clients for:
 * - bounties (`/api/bounties`)
 * - submissions (`/api/bounties/:id/submissions`)
 * - users (`/api/users`)
 *
 * @module rest-api
 */

import type { HttpClient } from './client.js';
import type {
  MarketplaceBountiesListParams,
  MarketplaceBountiesListResponse,
  MarketplaceBounty,
  MarketplaceBountyCreate,
  MarketplaceSubmission,
  MarketplaceSubmissionCreate,
  UserProfile,
  UserProfileUpdate,
} from './rest-types.js';

/**
 * Typed client for `/api/bounties` endpoints.
 */
export class MarketplaceBountiesClient {
  private readonly http: HttpClient;

  /**
   * Create a new marketplace bounties client.
   *
   * @param http - Shared HTTP client instance.
   */
  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * List bounties with optional filtering and pagination.
   *
   * @param params - Optional list filters and pagination options.
   * @returns Paginated list of bounties.
   */
  async list(params?: MarketplaceBountiesListParams): Promise<MarketplaceBountiesListResponse> {
    return this.http.request<MarketplaceBountiesListResponse>({
      path: '/api/bounties',
      method: 'GET',
      params: params as Record<string, string | number | boolean | undefined> | undefined,
    });
  }

  /**
   * Get a single bounty by ID.
   *
   * @param bountyId - Bounty identifier.
   * @returns Bounty details.
   */
  async get(bountyId: string): Promise<MarketplaceBounty> {
    return this.http.request<MarketplaceBounty>({
      path: `/api/bounties/${bountyId}`,
      method: 'GET',
    });
  }

  /**
   * Create a new bounty.
   *
   * @param payload - Bounty creation payload.
   * @returns Newly created bounty.
   */
  async create(payload: MarketplaceBountyCreate): Promise<MarketplaceBounty> {
    return this.http.request<MarketplaceBounty>({
      path: '/api/bounties',
      method: 'POST',
      body: payload,
      requiresAuth: true,
    });
  }
}

/**
 * Typed client for bounty submission endpoints.
 */
export class MarketplaceSubmissionsClient {
  private readonly http: HttpClient;

  /**
   * Create a new marketplace submissions client.
   *
   * @param http - Shared HTTP client instance.
   */
  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * List submissions for a bounty.
   *
   * @param bountyId - Bounty identifier.
   * @returns All submissions for the bounty.
   */
  async listForBounty(bountyId: string): Promise<MarketplaceSubmission[]> {
    return this.http.request<MarketplaceSubmission[]>({
      path: `/api/bounties/${bountyId}/submissions`,
      method: 'GET',
    });
  }

  /**
   * Create a submission for a bounty.
   *
   * @param bountyId - Bounty identifier.
   * @param payload - Submission payload.
   * @returns Created submission.
   */
  async createForBounty(
    bountyId: string,
    payload: MarketplaceSubmissionCreate,
  ): Promise<MarketplaceSubmission> {
    return this.http.request<MarketplaceSubmission>({
      path: `/api/bounties/${bountyId}/submissions`,
      method: 'POST',
      body: payload,
      requiresAuth: true,
    });
  }
}

/**
 * Typed client for `/api/users` endpoints.
 */
export class UsersClient {
  private readonly http: HttpClient;

  /**
   * Create a new users client.
   *
   * @param http - Shared HTTP client instance.
   */
  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Get the authenticated user profile.
   *
   * @returns Current user profile.
   */
  async me(): Promise<UserProfile> {
    return this.http.request<UserProfile>({
      path: '/api/users/me',
      method: 'GET',
      requiresAuth: true,
    });
  }

  /**
   * Get a user by ID.
   *
   * @param userId - User identifier.
   * @returns User profile.
   */
  async get(userId: string): Promise<UserProfile> {
    return this.http.request<UserProfile>({
      path: `/api/users/${userId}`,
      method: 'GET',
    });
  }

  /**
   * Update the authenticated user profile.
   *
   * @param payload - Profile fields to update.
   * @returns Updated user profile.
   */
  async updateMe(payload: UserProfileUpdate): Promise<UserProfile> {
    return this.http.request<UserProfile>({
      path: '/api/users/me',
      method: 'PATCH',
      body: payload,
      requiresAuth: true,
    });
  }
}

/**
 * Combined typed REST API surface for marketplace endpoints.
 */
export class MarketplaceApiClient {
  /** Bounty endpoint client. */
  public readonly bounties: MarketplaceBountiesClient;

  /** Submission endpoint client. */
  public readonly submissions: MarketplaceSubmissionsClient;

  /** User endpoint client. */
  public readonly users: UsersClient;

  /**
   * Create a marketplace API client wrapper.
   *
   * @param http - Shared HTTP client instance.
   */
  constructor(http: HttpClient) {
    this.bounties = new MarketplaceBountiesClient(http);
    this.submissions = new MarketplaceSubmissionsClient(http);
    this.users = new UsersClient(http);
  }
}
