/**
 * SolFoundry TypeScript SDK - API Client
 * Main entry point for interacting with the SolFoundry API
 */

import type {
  BountyResponse,
  BountyListResponse,
  BountyCreate,
  BountyUpdate,
  SubmissionCreate,
  SubmissionResponse,
  ContributorResponse,
  LeaderboardEntry,
  NotificationResponse,
  PayoutResponse,
  AuthToken,
  UserResponse,
  BountyFilters,
} from "../types/index.js";

const DEFAULT_BASE_URL = "https://api.solfoundry.dev";
const DEFAULT_TIMEOUT = 30_000;

export interface SolFoundryClientOptions {
  baseUrl?: string;
  apiKey?: string;
  timeout?: number;
  fetch?: typeof fetch;
}

export class SolFoundryError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: unknown
  ) {
    super(message);
    this.name = "SolFoundryError";
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorBody: unknown;
    try {
      errorBody = await res.json();
    } catch {
      errorBody = await res.text();
    }
    throw new SolFoundryError(
      `HTTP ${res.status}: ${res.statusText}`,
      res.status,
      errorBody
    );
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/**
 * Main SolFoundry API Client
 */
export class SolFoundryClient {
  private baseUrl: string;
  private apiKey?: string;
  private timeout: number;
  private fetch: typeof fetch;

  constructor(options: SolFoundryClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.apiKey = options.apiKey;
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
    this.fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  private headers(): HeadersInit {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await this.fetch(`${this.baseUrl}${path}`, {
        method,
        headers: this.headers(),
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timer);
      return handleResponse<T>(res);
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof SolFoundryError) throw err;
      throw new SolFoundryError(
        err instanceof Error ? err.message : "Network error",
        0
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Bounties
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * List bounties with optional filters
   */
  async listBounties(filters: BountyFilters = {}): Promise<BountyListResponse> {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.tier) params.set("tier", String(filters.tier));
    if (filters.skills?.length) params.set("skills", filters.skills.join(","));
    if (filters.skip) params.set("skip", String(filters.skip));
    if (filters.limit) params.set("limit", String(filters.limit));
    const qs = params.toString();
    return this.request<BountyListResponse>(
      "GET",
      `/api/bounties${qs ? `?${qs}` : ""}`
    );
  }

  /**
   * Get a single bounty by ID
   */
  async getBounty(bountyId: string): Promise<BountyResponse> {
    return this.request<BountyResponse>("GET", `/api/bounties/${bountyId}`);
  }

  /**
   * Create a new bounty
   */
  async createBounty(data: BountyCreate): Promise<BountyResponse> {
    return this.request<BountyResponse>("POST", "/api/bounties", data);
  }

  /**
   * Update a bounty
   */
  async updateBounty(
    bountyId: string,
    data: BountyUpdate
  ): Promise<BountyResponse> {
    return this.request<BountyResponse>(
      "PATCH",
      `/api/bounties/${bountyId}`,
      data
    );
  }

  /**
   * Delete a bounty
   */
  async deleteBounty(bountyId: string): Promise<void> {
    return this.request<void>("DELETE", `/api/bounties/${bountyId}`);
  }

  /**
   * Submit a PR solution for a bounty
   */
  async submitSolution(
    bountyId: string,
    data: SubmissionCreate
  ): Promise<SubmissionResponse> {
    return this.request<SubmissionResponse>(
      "POST",
      `/api/bounties/${bountyId}/submit`,
      data
    );
  }

  /**
   * List submissions for a bounty
   */
  async getSubmissions(bountyId: string): Promise<SubmissionResponse[]> {
    return this.request<SubmissionResponse[]>(
      "GET",
      `/api/bounties/${bountyId}/submissions`
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Contributors
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get a contributor by GitHub username
   */
  async getContributor(githubUsername: string): Promise<ContributorResponse> {
    return this.request<ContributorResponse>(
      "GET",
      `/contributors/${githubUsername}`
    );
  }

  /**
   * List all contributors
   */
  async listContributors(
    skip = 0,
    limit = 20
  ): Promise<{ items: ContributorResponse[]; total: number }> {
    return this.request<{ items: ContributorResponse[]; total: number }>(
      "GET",
      `/contributors?skip=${skip}&limit=${limit}`
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Leaderboard
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get the leaderboard
   */
  async getLeaderboard(
    period: "weekly" | "monthly" | "all_time" = "all_time",
    limit = 20
  ): Promise<LeaderboardEntry[]> {
    return this.request<LeaderboardEntry[]>(
      "GET",
      `/leaderboard?period=${period}&limit=${limit}`
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Notifications
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * List notifications for the authenticated user
   */
  async listNotifications(
    unreadOnly = false
  ): Promise<NotificationResponse[]> {
    return this.request<NotificationResponse[]>(
      "GET",
      `/api/notifications?unread_only=${unreadOnly}`
    );
  }

  /**
   * Mark a notification as read
   */
  async markNotificationRead(notificationId: string): Promise<void> {
    return this.request<void>(
      "PATCH",
      `/api/notifications/${notificationId}/read`
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Payouts
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get payout history for a contributor
   */
  async getPayouts(
    contributorId?: string
  ): Promise<PayoutResponse[]> {
    const path = contributorId
      ? `/payouts?contributor_id=${contributorId}`
      : "/payouts";
    return this.request<PayoutResponse[]>("GET", path);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Health
  // ─────────────────────────────────────────────────────────────────────────

  /** Check API health */
  async health(): Promise<{ status: string }> {
    return this.request<{ status: string }>("GET", "/health");
  }
}

// Default export for convenience
export default SolFoundryClient;
