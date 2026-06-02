/**
 * Leaderboard and auth client resource module for the SolFoundry SDK.
 *
 * Provides high-level SDK interfaces to fetch programmatic developer ranking
 * and authenticate contributor profile permissions.
 *
 * @module leaderboard
 */

import type { HttpClient } from './client.js';
import type { ContributorResponse } from './types.js';

export interface LeaderboardResponse {
  /** Ranked list of top contributors in the system. */
  readonly leaderboard: ContributorResponse[];
  /** ISO timestamp of the last leaderboard aggregation. */
  readonly aggregated_at: string;
}

export interface AuthSessionResponse {
  /** Contributor profile details of the authenticated requester. */
  readonly profile: ContributorResponse;
  /** JWT bearer access token for session updates. */
  readonly token: string;
}

/**
 * Client for managing developer leaderboards and user authentication.
 */
export class LeaderboardClient {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Fetch the global contributor leaderboard rankings.
   *
   * @param limit - Maximum number of ranked contributors to fetch. Defaults to 50.
   */
  async getGlobal(limit?: number): Promise<LeaderboardResponse> {
    return this.http.request<LeaderboardResponse>({
      path: '/api/leaderboard',
      method: 'GET',
      params: { limit },
    });
  }

  /**
   * Authenticate a contributor profile using GitHub OAuth credential verification.
   *
   * @param code - The raw authorization code returned from GitHub OAuth flow.
   */
  async authenticateGithub(code: string): Promise<AuthSessionResponse> {
    return this.http.request<AuthSessionResponse>({
      path: '/api/auth/github',
      method: 'POST',
      body: { code },
    });
  }
}
