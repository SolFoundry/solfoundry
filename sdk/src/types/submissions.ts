import type { JsonObject, PaginatedResponse, ResourceId, SortOrder, Timestamps } from "./common.js";

/**
 * Submission workflow state.
 */
export type SubmissionStatus = "submitted" | "under_review" | "changes_requested" | "approved" | "rejected";

/**
 * Reviewer decision payload.
 */
export interface ReviewDecision {
  /**
   * Free-form reviewer feedback.
   */
  comment?: string;
  /**
   * Optional structured score or rubric data.
   */
  metadata?: JsonObject;
}

/**
 * SolFoundry submission resource.
 */
export interface Submission extends Timestamps {
  /**
   * Unique submission identifier.
   */
  id: ResourceId;
  /**
   * Associated bounty identifier.
   */
  bountyId: ResourceId;
  /**
   * Submitter user identifier.
   */
  userId: ResourceId;
  /**
   * Current review state.
   */
  status: SubmissionStatus;
  /**
   * URL pointing at the submission artifact.
   */
  artifactUrl?: string;
  /**
   * Text summary of the submission.
   */
  content?: string;
  /**
   * Optional reviewer feedback.
   */
  review?: ReviewDecision;
  /**
   * Additional provider-defined attributes.
   */
  metadata?: JsonObject;
}

/**
 * Payload for creating a submission.
 *
 * At least one of `artifactUrl` or `content` must be provided.
 */
type CreateSubmissionBase = {
  /**
   * Associated bounty identifier.
   */
  bountyId: ResourceId;
  /**
   * Additional provider-defined attributes.
   */
  metadata?: JsonObject;
};

export type CreateSubmissionInput =
  | (CreateSubmissionBase & {
      /**
       * URL pointing at the submission artifact.
       */
      artifactUrl: string;
      /**
       * Text summary of the submission.
       */
      content?: string;
    })
  | (CreateSubmissionBase & {
      /**
       * URL pointing at the submission artifact.
       */
      artifactUrl?: string;
      /**
       * Text summary of the submission.
       */
      content: string;
    });

/**
 * Payload for reviewing a submission.
 */
export interface ReviewSubmissionInput extends ReviewDecision {
  /**
   * The resulting submission state after review.
   */
  status: Extract<SubmissionStatus, "under_review" | "changes_requested" | "rejected">;
}

/**
 * Payload for approving a submission.
 */
export interface ApproveSubmissionInput extends ReviewDecision {
  /**
   * Optional payout id or settlement reference.
   */
  settlementReference?: string;
}

/**
 * Query options for listing submissions.
 */
export interface ListSubmissionsParams {
  /**
   * Pagination cursor.
   */
  cursor?: string;
  /**
   * Page size.
   */
  limit?: number;
  /**
   * Filter by bounty.
   */
  bountyId?: ResourceId;
  /**
   * Filter by submitter.
   */
  userId?: ResourceId;
  /**
   * Filter by submission status.
   */
  status?: SubmissionStatus;
  /**
   * Sort order for creation time.
   */
  sort?: SortOrder;
}

/**
 * Paginated submission list.
 */
export type SubmissionListResponse = PaginatedResponse<Submission>;
