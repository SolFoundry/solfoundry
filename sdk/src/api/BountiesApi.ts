import { BaseApi } from "./BaseApi.js";
import type {
  Bounty,
  BountyListResponse,
  CreateBountyInput,
  ListBountiesParams,
  UpdateBountyInput,
} from "../types/index.js";

/**
 * Bounty management endpoints.
 */
export class BountiesApi extends BaseApi {
  /**
   * Creates a new bounty.
   */
  public async create(input: CreateBountyInput): Promise<Bounty> {
    return this.httpClient.request<Bounty>("POST", "/bounties", { body: input });
  }

  /**
   * Returns a paginated list of bounties.
   */
  public async list(params: ListBountiesParams = {}): Promise<BountyListResponse> {
    return this.httpClient.request<BountyListResponse>("GET", "/bounties", { query: params });
  }

  /**
   * Fetches a single bounty by id.
   */
  public async getById(bountyId: string): Promise<Bounty> {
    return this.httpClient.request<Bounty>("GET", `/bounties/${encodeURIComponent(bountyId)}`);
  }

  /**
   * Applies a partial update to an existing bounty.
   */
  public async update(bountyId: string, input: UpdateBountyInput): Promise<Bounty> {
    return this.httpClient.request<Bounty>("PATCH", `/bounties/${encodeURIComponent(bountyId)}`, {
      body: input,
    });
  }

  /**
   * Deletes a bounty permanently.
   */
  public async delete(bountyId: string): Promise<void> {
    return this.httpClient.request<void>("DELETE", `/bounties/${encodeURIComponent(bountyId)}`, {
      responseType: "void",
    });
  }
}
