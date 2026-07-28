/**
 * Submission resource module for the SolFoundry SDK.
 *
 * Provides methods for managing solution submissions to bounties,
 * including creating new submissions, listing submissions for a
 * bounty, updating submission status, and retrieving AI review results.
 *
 * @module submissions
 */

import type { HttpClient } from './client.js';
import type {
  SubmissionCreate,
  SubmissionResponse,
  SubmissionStatusUpdate,
  SubmissionReviewResponse,
} from './types.js';

/**
 * Client for interacting with the SolFoundry submission API.
 *
 * Wraps `/api/bounties/{bountyId}/submissions` endpoints with
 * type-safe methods. Provides a dedicated interface for all
 * submission lifecycle operations separate from bounty management.
 *
 * @example
 * ```typescript
 * const submissions = new SubmissionsClient(http);
 *
 * // Submit a solution to a bounty
 * const submission = await submissions.create('bounty-uuid', {
 *   pr_url: 'https://github.com/owner/repo/pull/42',
 * });
 *
 * // List all submissions for a bounty
 * const all = await submissions.list('bounty-uuid');
 *
 * // Get AI review details
 * const review = await submissions.getReview('bounty-uuid', 'submission-uuid');
 * ```
 */
export class SubmissionsClient {
  private readonly http: HttpClient;

  /**
   * Create a new SubmissionsClient.
   *
   * @param http - The configured HTTP client for API communication.
   */
  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * List all submissions for a specific bounty.
   *
   * Returns all solution submissions including their review scores,
   * approval status, and payout information. Results are sorted by
   * submission date (newest first).
   *
   * @param bountyId - The UUID of the bounty whose submissions to list.
   * @returns Array of submission responses.
   * @throws {NotFoundError} If the bounty does not exist.
   */
  async list(bountyId: string): Promise<SubmissionResponse[]> {
    return this.http.request<SubmissionResponse[]>({
      path: `/api/bounties/${bountyId}/submissions`,
      method: 'GET',
    });
  }

  /**
   * Get a specific submission by its UUID.
   *
   * Returns the full submission details including AI review scores,
   * approval status, and payout information.
   *
   * @param bountyId - The UUID of the parent bounty.
   * @param submissionId - The UUID of the submission to retrieve.
   * @returns The full submission response.
   * @throws {NotFoundError} If the bounty or submission does not exist.
   */
  async get(bountyId: string, submissionId: string): Promise<SubmissionResponse> {
    return this.http.request<SubmissionResponse>({
      path: `/api/bounties/${bountyId}/submissions/${submissionId}`,
      method: 'GET',
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
   * @throws {AuthenticationError} If not authenticated.
   */
  async create(bountyId: string, data: SubmissionCreate): Promise<SubmissionResponse> {
    return this.http.request<SubmissionResponse>({
      path: `/api/bounties/${bountyId}/submissions`,
      method: 'POST',
      body: data,
      requiresAuth: true,
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
   * @throws {AuthorizationError} If the user does not own the bounty.
   */
  async updateStatus(
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
   * Get the AI review details for a submission.
   *
   * Returns the complete multi-LLM review results including individual
   * model scores, aggregated score, model-specific feedback, and
   * detailed review comments.
   *
   * @param bountyId - The UUID of the parent bounty.
   * @param submissionId - The UUID of the submission to review.
   * @returns AI review details with per-model scores and feedback.
   * @throws {NotFoundError} If the bounty or submission does not exist.
   */
  async getReview(
    bountyId: string,
    submissionId: string,
  ): Promise<SubmissionReviewResponse> {
    return this.http.request<SubmissionReviewResponse>({
      path: `/api/bounties/${bountyId}/submissions/${submissionId}/review`,
      method: 'GET',
    });
  }
}