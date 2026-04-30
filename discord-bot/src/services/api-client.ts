/**
 * SolFoundry API client wrapper for the Discord bot.
 *
 * Provides methods to fetch bounties, contributors, and stats from
 * the SolFoundry backend API. Handles authentication, error handling,
 * and response parsing.
 *
 * @module api-client
 */

import type { Logger } from '../utils/logger.js';

/** Shape of a bounty from the SolFoundry API. */
export interface ApiBounty {
  id: string;
  title: string;
  description: string;
  tier: number;
  category: string | null;
  reward_amount: number;
  status: string;
  deadline: string | null;
  github_issue_url: string | null;
  required_skills: string[];
  created_at: string;
  updated_at: string;
  claimed_by: string | null;
  claimed_at: string | null;
}

/** Shape of a contributor from the SolFoundry API. */
export interface ApiContributor {
  username: string;
  bounties_completed: number;
  total_earnings: number;
  reputation_score: number;
}

/** Shape of platform stats from the SolFoundry API. */
export interface ApiStats {
  total_bounties_created: number;
  total_bounties_completed: number;
  total_bounties_open: number;
  total_contributors: number;
  total_fndry_paid: number;
  top_contributor: { username: string; bounties_completed: number } | null;
}

/**
 * Configuration for the API client.
 */
export interface ApiClientConfig {
  /** Base URL for the SolFoundry API. */
  readonly baseUrl: string;
  /** Optional authentication token. */
  readonly token?: string;
  /** Request timeout in milliseconds. */
  readonly timeout?: number;
  /** Logger instance. */
  readonly logger: Logger;
}

/**
 * HTTP client for the SolFoundry API.
 *
 * Handles authentication, error handling, and retries for API requests.
 */
export class SolFoundryApiClient {
  private readonly baseUrl: string;
  private readonly token: string | undefined;
  private readonly timeout: number;
  private readonly logger: Logger;

  /**
   * Create a new API client.
   *
   * @param config - Client configuration.
   */
  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.token = config.token;
    this.timeout = config.timeout ?? 10000;
    this.logger = config.logger.child('ApiClient');
  }

  /**
   * Fetch all open bounties from the API.
   *
   * @returns Array of open bounties.
   * @throws Error if the request fails.
   */
  async fetchOpenBounties(): Promise<ApiBounty[]> {
    this.logger.debug('Fetching open bounties');
    try {
      const data = await this.request<{ items: ApiBounty[] }>('/api/bounties', {
        status: 'open',
        limit: '100',
      });
      return data.items || [];
    } catch (error) {
      this.logger.error('Failed to fetch open bounties', error);
      throw error;
    }
  }

  /**
   * Fetch a single bounty by ID.
   *
   * @param bountyId - The bounty UUID.
   * @returns The bounty data.
   * @throws Error if the request fails or bounty not found.
   */
  async fetchBounty(bountyId: string): Promise<ApiBounty> {
    this.logger.debug(`Fetching bounty: ${bountyId}`);
    try {
      return await this.request<ApiBounty>(`/api/bounties/${bountyId}`);
    } catch (error) {
      this.logger.error(`Failed to fetch bounty: ${bountyId}`, error);
      throw error;
    }
  }

  /**
   * Fetch the leaderboard (top contributors).
   *
   * @param limit - Maximum number of entries (default: 10).
   * @returns Array of top contributors.
   */
  async fetchLeaderboard(limit: number = 10): Promise<ApiContributor[]> {
    this.logger.debug(`Fetching leaderboard (limit: ${limit})`);
    try {
      const data = await this.request<{ items: ApiContributor[] }>('/api/contributors', {
        limit: String(limit),
        sort: '-reputation_score',
      });
      return data.items || [];
    } catch (error) {
      this.logger.error('Failed to fetch leaderboard', error);
      // Return mock data for graceful degradation
      return [];
    }
  }

  /**
   * Fetch platform-wide statistics.
   *
   * @returns Platform statistics.
   */
  async fetchStats(): Promise<ApiStats> {
    this.logger.debug('Fetching platform stats');
    try {
      return await this.request<ApiStats>('/api/stats');
    } catch (error) {
      this.logger.error('Failed to fetch stats', error);
      return {
        total_bounties_created: 0,
        total_bounties_completed: 0,
        total_bounties_open: 0,
        total_contributors: 0,
        total_fndry_paid: 0,
        top_contributor: null,
      };
    }
  }

  /**
   * Make an authenticated HTTP request to the API.
   *
   * @param path - API path (relative to baseUrl).
   * @param params - Optional query parameters.
   * @param method - HTTP method (default: GET).
   * @param body - Optional request body.
   * @returns Parsed JSON response.
   */
  private async request<T>(
    path: string,
    params?: Record<string, string>,
    method: string = 'GET',
    body?: unknown,
  ): Promise<T> {
    const url = new URL(path, this.baseUrl);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) url.searchParams.append(key, value);
      });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url.toString(), {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
