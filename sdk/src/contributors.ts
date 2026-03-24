/**
 * Contributor resource module for the SolFoundry SDK.
 *
 * Provides methods for managing contributor profiles, listing
 * contributors with filtering, and querying individual profiles
 * including reputation scores and tier progression.
 *
 * @module contributors
 */

import type { HttpClient } from './client.js';
import type {
  ContributorCreate,
  ContributorListResponse,
  ContributorResponse,
  ContributorUpdate,
  HealthResponse,
  StatsResponse,
} from './types.js';

/**
 * Client for interacting with the SolFoundry contributor and stats APIs.
 *
 * Wraps `/api/contributors`, `/api/stats`, and `/health` endpoints
 * with type-safe methods.
 *
 * @example
 * ```typescript
 * const contributors = new ContributorClient(httpClient);
 *
 * // List contributors with skill filter
 * const list = await contributors.list({ skills: 'python,fastapi' });
 *
 * // Get a specific contributor profile
 * const profile = await contributors.get('contributor-uuid');
 * console.log(profile.reputation_score);
 * ```
 */
export class ContributorClient {
  private readonly http: HttpClient;

  /**
   * Create a new ContributorClient.
   *
   * @param http - The configured HTTP client for API communication.
   */
  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * List contributors with optional filtering and pagination.
   *
   * Supports text search on username/display name, skill filtering,
   * badge filtering, and pagination.
   *
   * @param options - Optional query parameters for filtering.
   * @param options.search - Case-insensitive substring match on username/display name.
   * @param options.skills - Comma-separated skill names to filter by.
   * @param options.badges - Comma-separated badge names to filter by.
   * @param options.skip - Pagination offset (default 0).
   * @param options.limit - Page size (default 20, max 100).
   * @returns Paginated contributor list with total count.
   */
  async list(options?: {
    search?: string;
    skills?: string;
    badges?: string;
    skip?: number;
    limit?: number;
  }): Promise<ContributorListResponse> {
    return this.http.request<ContributorListResponse>({
      path: '/api/contributors',
      method: 'GET',
      params: {
        search: options?.search,
        skills: options?.skills,
        badges: options?.badges,
        skip: options?.skip,
        limit: options?.limit,
      },
    });
  }

  /**
   * Get a specific contributor profile by UUID.
   *
   * Returns full profile data including reputation score, tier
   * progression, earned badges, and total bounties completed.
   *
   * @param contributorId - The UUID of the contributor.
   * @returns The full contributor profile.
   * @throws {NotFoundError} If the contributor does not exist.
   */
  async get(contributorId: string): Promise<ContributorResponse> {
    return this.http.request<ContributorResponse>({
      path: `/api/contributors/${contributorId}`,
      method: 'GET',
    });
  }

  /**
   * Create a new contributor profile.
   *
   * Registers a new contributor in the system with their GitHub
   * username, optional display name, wallet address, and skills.
   *
   * @param data - Contributor creation payload.
   * @returns The created contributor profile with assigned UUID.
   * @throws {ValidationError} If the contributor data is invalid.
   * @throws {ConflictError} If the username is already registered.
   */
  async create(data: ContributorCreate): Promise<ContributorResponse> {
    return this.http.request<ContributorResponse>({
      path: '/api/contributors',
      method: 'POST',
      body: data,
      requiresAuth: true,
    });
  }

  /**
   * Update an existing contributor profile.
   *
   * Partially updates the contributor's profile. Only provided
   * fields are updated; omitted fields remain unchanged.
   *
   * @param contributorId - The UUID of the contributor to update.
   * @param data - Fields to update (all optional).
   * @returns The updated contributor profile.
   * @throws {NotFoundError} If the contributor does not exist.
   * @throws {AuthorizationError} If the user cannot modify this profile.
   */
  async update(contributorId: string, data: ContributorUpdate): Promise<ContributorResponse> {
    return this.http.request<ContributorResponse>({
      path: `/api/contributors/${contributorId}`,
      method: 'PATCH',
      body: data,
      requiresAuth: true,
    });
  }

  /**
   * Get aggregate bounty program statistics.
   *
   * Returns total bounties, contributors, $FNDRY paid, and
   * tier breakdowns. This is a public endpoint (no auth required).
   * Results are cached server-side for 5 minutes.
   *
   * @returns Bounty program aggregate statistics.
   */
  async getStats(): Promise<StatsResponse> {
    return this.http.request<StatsResponse>({
      path: '/api/stats',
      method: 'GET',
    });
  }

  /**
   * Check the health of the SolFoundry API service.
   *
   * Returns the service status including database and Redis
   * connectivity. Useful for monitoring and readiness checks.
   *
   * @returns Health check response with service statuses.
   */
  async getHealth(): Promise<HealthResponse> {
    return this.http.request<HealthResponse>({
      path: '/health',
      method: 'GET',
    });
  }
}
