import { BaseApi } from "./BaseApi.js";
import type {
  ApproveSubmissionInput,
  CreateSubmissionInput,
  ListSubmissionsParams,
  ReviewSubmissionInput,
  Submission,
  SubmissionListResponse,
} from "../types/index.js";

/**
 * Submission and review endpoints.
 */
export class SubmissionsApi extends BaseApi {
  /**
   * Creates a new submission for a bounty.
   */
  public async submit(input: CreateSubmissionInput): Promise<Submission> {
    return this.httpClient.request<Submission>("POST", "/submissions", { body: input });
  }

  /**
   * Returns a paginated list of submissions.
   */
  public async list(params: ListSubmissionsParams = {}): Promise<SubmissionListResponse> {
    return this.httpClient.request<SubmissionListResponse>("GET", "/submissions", {
      query: params,
    });
  }

  /**
   * Fetches a single submission by id.
   */
  public async getById(submissionId: string): Promise<Submission> {
    return this.httpClient.request<Submission>(
      "GET",
      `/submissions/${encodeURIComponent(submissionId)}`,
    );
  }

  /**
   * Reviews an existing submission.
   */
  public async review(
    submissionId: string,
    input: ReviewSubmissionInput,
  ): Promise<Submission> {
    return this.httpClient.request<Submission>(
      "POST",
      `/submissions/${encodeURIComponent(submissionId)}/review`,
      { body: input },
    );
  }

  /**
   * Approves a submission.
   */
  public async approve(
    submissionId: string,
    input: ApproveSubmissionInput = {},
  ): Promise<Submission> {
    return this.httpClient.request<Submission>(
      "POST",
      `/submissions/${encodeURIComponent(submissionId)}/approve`,
      { body: input },
    );
  }
}
