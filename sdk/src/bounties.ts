/**
 * Bounty resource module for the SolFoundry SDK.
 *
 * Provides methods for bounty CRUD operations, solution submissions,
 * searching, and autocomplete. All methods delegate HTTP calls to
 * the core {@link HttpClient} and return strongly-typed responses.
 *
 * @module bounties
 */

import type { HttpClient } from './client.js';
import type {
  AutocompleteResponse,
  BountyCreate,
  BountyListResponse,
  BountyResponse,
  BountySearchParams,
  BountySearchResponse,
  BountyUpdate,
  SubmissionCreate,
  SubmissionResponse,
  SubmissionStatusUpdate,
} from './types.js';

/**
 * Client for interacting with the SolFoundry bounty API.
 *
 * Wraps all `/api/bounties` endpoints with type-safe methods.
 * Requires an authenticated {@link HttpClient} for mutation operations
 * (create, update, delete, submit).
 *
 * @example
 * ```typescript
 * const bounties = new BountyClient(httpClient);
 *
 * // List open bounties
 * const list = await bounties.list({ status: 'open', limit: 10 });
 *
 * // Create a new bounty
 * const created = await bounties.create({
 *   title: 'Implement search API',
 *   reward_amount: 500,
 * });
 * ```
 */
export class BountyClient {
  private readonly http: HttpClient;

  /**
   * Create a new BountyClient.
   *
   * @param http - The configured HTTP client for API communication.
   */
  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * List bounties with optional filtering and pagination.
   *
   * Returns a paginated list of bounties. Supports filtering by status,
   * tier, and other criteria via query parameters.
   *
   * @param options - Optional query parameters for filtering and pagination.
   * @param options.status - Filter by bounty lifecycle status.
   * @param options.tier - Filter by bounty tier (1, 2, or 3).
   * @param options.skip - Pagination offset (default 0).
   * @param options.limit - Page size (default 20, max 100).
   * @returns Paginated bounty list with total count.
   */
  async list(options?: {
    status?: string;
    tier?: number;
    skip?: number;
    limit?: number;
  }): Promise<BountyListResponse> {
    return this.http.request<BountyListResponse>({
      path: '/api/bounties',
      method: 'GET',
      params: {
        status: options?.status,
        tier: options?.tier,
        skip: options?.skip,
        limit: options?.limit,
      },
    });
  }

  /**
   * Get full details for a specific bounty by its UUID.
   *
   * Returns the complete bounty object including all submissions,
   * claim status, and payout information.
   *
   * @param bountyId - The UUID of the bounty to retrieve.
   * @returns The full bounty response.
   * @throws {NotFoundError} If the bounty does not exist.
   */
  async get(bountyId: string): Promise<BountyResponse> {
    return this.http.request<BountyResponse>({
      path: `/api/bounties/${bountyId}`,
      method: 'GET',
    });
  }

  /**
   * Create a new bounty in the marketplace.
   *
   * Requires authentication. The authenticated user is recorded as
   * the bounty creator and owner.
   *
   * @param data - Bounty creation payload with title, reward, and optional fields.
   * @returns The created bounty with its assigned UUID and timestamps.
   * @throws {ValidationError} If the bounty data is invalid.
   * @throws {AuthenticationError} If not authenticated.
   */
  async create(data: BountyCreate): Promise<BountyResponse> {
    return this.http.request<BountyResponse>({
      path: '/api/bounties',
      method: 'POST',
      body: data,
      requiresAuth: true,
    });
  }

  /**
   * Partially update an existing bounty (PATCH semantics).
   *
   * Only the provided fields are updated; omitted fields remain unchanged.
   * Requires authentication and ownership of the bounty.
   *
   * @param bountyId - The UUID of the bounty to update.
   * @param data - Fields to update (all optional).
   * @returns The updated bounty response.
   * @throws {NotFoundError} If the bounty does not exist.
   * @throws {AuthorizationError} If the user does not own the bounty.
   */
  async update(bountyId: string, data: BountyUpdate): Promise<BountyResponse> {
    return this.http.request<BountyResponse>({
      path: `/api/bounties/${bountyId}`,
      method: 'PATCH',
      body: data,
      requiresAuth: true,
    });
  }

  /**
   * Delete a bounty permanently.
   *
   * Requires authentication and ownership. Only bounties in certain
   * lifecycle states (draft, open) can be deleted.
   *
   * @param bountyId - The UUID of the bounty to delete.
   * @throws {NotFoundError} If the bounty does not exist.
   * @throws {AuthorizationError} If the user does not own the bounty.
   */
  async delete(bountyId: string): Promise<void> {
    await this.http.request<void>({
      path: `/api/bounties/${bountyId}`,
      method: 'DELETE',
      requiresAuth: true,
    });
  }

  /**
   * Submit a solution (pull request) to a bounty.
   *
   * Creates a new submission that will be reviewed by the multi-LLM
   * pipeline. Requires authentication.
   *
   * @param bountyId - The UUID of the bounty to submit a solution for.
   * @param data - Submission payload with PR URL and optional metadata.
   * @returns The created submission with review status fields.
   * @throws {NotFoundError} If the bounty does not exist.
   * @throws {ValidationError} If the submission data is invalid.
   */
  async submitSolution(bountyId: string, data: SubmissionCreate): Promise<SubmissionResponse> {
    return this.http.request<SubmissionResponse>({
      path: `/api/bounties/${bountyId}/submissions`,
      method: 'POST',
      body: data,
      requiresAuth: true,
    });
  }

  /**
   * List all submissions for a specific bounty.
   *
   * Returns all solution submissions including their review scores,
   * approval status, and payout information.
   *
   * @param bountyId - The UUID of the bounty whose submissions to list.
   * @returns Array of submission responses.
   * @throws {NotFoundError} If the bounty does not exist.
   */
  async listSubmissions(bountyId: string): Promise<SubmissionResponse[]> {
    return this.http.request<SubmissionResponse[]>({
      path: `/api/bounties/${bountyId}/submissions`,
      method: 'GET',
    });
  }

  /**
   * Update the status of a specific submission.
   *
   * Used for approving, rejecting, or otherwise transitioning a
   * submission through its lifecycle. Requires authentication and
   * ownership of the parent bounty.
   *
   * @param bountyId - The UUID of the parent bounty.
   * @param submissionId - The UUID of the submission to update.
   * @param data - New status value.
   * @returns The updated submission response.
   * @throws {NotFoundError} If the bounty or submission does not exist.
   * @throws {ConflictError} If the state transition is not allowed.
   */
  async updateSubmissionStatus(
    bountyId: string,
    submissionId: string,
    data: SubmissionStatusUpdate,
  ): Promise<SubmissionResponse> {
    return this.http.request<SubmissionResponse>({
      path: `/api/bounties/${bountyId}/submissions/${submissionId}/status`,
      method: 'PATCH',
      body: data,
      requiresAuth: true,
    });
  }

  /**
   * Search bounties with full-text query and advanced filters.
   *
   * Supports text search, tier/status/category filtering, reward
   * range filtering, skill matching, and multiple sort orders.
   *
   * @param params - Search parameters including query, filters, and pagination.
   * @returns Paginated search results with relevance scores.
   */
  async search(params: BountySearchParams): Promise<BountySearchResponse> {
    const queryParams: Record<string, string | number | boolean | undefined> = {
      q: params.q,
      status: params.status,
      tier: params.tier,
      category: params.category,
      creator_type: params.creator_type,
      creator_id: params.creator_id,
      reward_min: params.reward_min,
      reward_max: params.reward_max,
      deadline_before: params.deadline_before,
      sort: params.sort,
      page: params.page,
      per_page: params.per_page,
    };

    // Skills are passed as comma-separated
    if (params.skills && params.skills.length > 0) {
      queryParams['skills'] = params.skills.join(',');
    }

    return this.http.request<BountySearchResponse>({
      path: '/api/bounties/search',
      method: 'GET',
      params: queryParams,
    });
  }

  /**
   * Get autocomplete suggestions for bounty search.
   *
   * Returns title and skill suggestions matching the input prefix,
   * useful for building search-as-you-type UI components.
   *
   * @param query - The partial search query to autocomplete.
   * @param limit - Maximum number of suggestions (default 10).
   * @returns Autocomplete suggestions with type and optional bounty ID.
   */
  async autocomplete(query: string, limit?: number): Promise<AutocompleteResponse> {
    return this.http.request<AutocompleteResponse>({
      path: '/api/bounties/autocomplete',
      method: 'GET',
      params: { q: query, limit },
    });
  }
}
