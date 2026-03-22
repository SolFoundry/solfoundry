/**
 * SolFoundry SDK — Core Client
 */

import type {
  Bounty,
  BountyFilter,
  Contributor,
  ContributorFilter,
  PaginatedResponse,
  SolFoundryClientConfig,
  SubmitWorkParams,
  WorkSubmission,
} from './types.js';

const DEFAULT_BASE_URL = 'https://api.solfoundry.io';
const DEFAULT_TIMEOUT = 10_000;

export class SolFoundryError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'SolFoundryError';
  }
}

/**
 * SolFoundryClient — main entry point for the SolFoundry TypeScript SDK.
 *
 * @example
 * ```ts
 * const client = new SolFoundryClient({ apiKey: 'your-api-key' });
 * const bounties = await client.getBounties({ status: 'open' });
 * ```
 */
export class SolFoundryClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeout: number;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(config: SolFoundryClientConfig = {}) {
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
    this.fetchImpl = config.fetch ?? globalThis.fetch;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  private buildUrl(path: string, params?: Record<string, unknown>): string {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            for (const v of value) url.searchParams.append(key, String(v));
          } else {
            url.searchParams.set(key, String(value));
          }
        }
      }
    }
    return url.toString();
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    options: { params?: Record<string, unknown>; body?: unknown } = {},
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    const url = this.buildUrl(path, options.params);

    try {
      const response = await this.fetchImpl(url, {
        method,
        headers: this.buildHeaders(),
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        let errorBody: { message?: string; code?: string } = {};
        try {
          errorBody = await response.json();
        } catch {
          // ignore JSON parse errors on error responses
        }
        throw new SolFoundryError(
          errorBody.message ?? `HTTP ${response.status}`,
          response.status,
          errorBody.code,
        );
      }

      return (await response.json()) as T;
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof SolFoundryError) throw err;
      if ((err as Error).name === 'AbortError') {
        throw new SolFoundryError(`Request timed out after ${this.timeout}ms`);
      }
      throw new SolFoundryError(`Network error: ${(err as Error).message}`);
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  /**
   * Fetch a paginated list of bounties, optionally filtered.
   */
  async getBounties(filter?: BountyFilter): Promise<PaginatedResponse<Bounty>> {
    return this.request<PaginatedResponse<Bounty>>('GET', '/v1/bounties', {
      params: filter as Record<string, unknown>,
    });
  }

  /**
   * Fetch a single bounty by ID or issue number.
   */
  async getBounty(id: string | number): Promise<Bounty> {
    return this.request<Bounty>('GET', `/v1/bounties/${id}`);
  }

  /**
   * Fetch a paginated list of contributors.
   */
  async getContributors(
    filter?: ContributorFilter,
  ): Promise<PaginatedResponse<Contributor>> {
    return this.request<PaginatedResponse<Contributor>>(
      'GET',
      '/v1/contributors',
      { params: filter as Record<string, unknown> },
    );
  }

  /**
   * Fetch a single contributor by GitHub handle or ID.
   */
  async getContributor(handle: string): Promise<Contributor> {
    return this.request<Contributor>('GET', `/v1/contributors/${handle}`);
  }

  /**
   * Submit work for a bounty (requires API key).
   */
  async submitWork(params: SubmitWorkParams): Promise<WorkSubmission> {
    if (!this.apiKey) {
      throw new SolFoundryError(
        'An API key is required to submit work. Pass apiKey to SolFoundryClient.',
        401,
        'UNAUTHORIZED',
      );
    }
    return this.request<WorkSubmission>('POST', '/v1/submissions', {
      body: params,
    });
  }

  /**
   * Fetch all submissions for a bounty.
   */
  async getBountySubmissions(bountyId: string): Promise<WorkSubmission[]> {
    return this.request<WorkSubmission[]>(
      'GET',
      `/v1/bounties/${bountyId}/submissions`,
    );
  }

  /**
   * Fetch the authenticated contributor's own submissions.
   * Requires API key.
   */
  async getMySubmissions(): Promise<WorkSubmission[]> {
    if (!this.apiKey) {
      throw new SolFoundryError(
        'An API key is required. Pass apiKey to SolFoundryClient.',
        401,
        'UNAUTHORIZED',
      );
    }
    return this.request<WorkSubmission[]>('GET', '/v1/submissions/me');
  }
}
