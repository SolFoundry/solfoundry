import { Bounty, Contributor, WorkSubmission, SolFoundryConfig, PaginatedResponse } from './types';

const DEFAULT_API_URL = 'https://api.solfoundry.io';

export class SolFoundryClient {
  private apiBaseUrl: string;
  private headers: Record<string, string>;

  constructor(config: SolFoundryConfig = {}) {
    this.apiBaseUrl = config.apiBaseUrl ?? DEFAULT_API_URL;
    this.headers = { 'Content-Type': 'application/json' };
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.apiBaseUrl}${path}`;
    const res = await fetch(url, { ...options, headers: { ...this.headers, ...options.headers } });
    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      throw new Error(`SolFoundry API error ${res.status}: ${err}`);
    }
    return res.json() as Promise<T>;
  }

  /** Fetch all open bounties with optional filters */
  async getBounties(params?: { tier?: string; status?: string; page?: number; pageSize?: number }): Promise<PaginatedResponse<Bounty>> {
    const qs = new URLSearchParams();
    if (params?.tier) qs.set('tier', params.tier);
    if (params?.status) qs.set('status', params.status ?? 'open');
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    return this.request<PaginatedResponse<Bounty>>(`/bounties?${qs}`);
  }

  /** Fetch a single bounty by ID */
  async getBounty(id: string): Promise<Bounty> {
    return this.request<Bounty>(`/bounties/${id}`);
  }

  /** Fetch contributors leaderboard */
  async getContributors(params?: { page?: number; pageSize?: number }): Promise<PaginatedResponse<Contributor>> {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    return this.request<PaginatedResponse<Contributor>>(`/contributors?${qs}`);
  }

  /** Fetch a single contributor by wallet address */
  async getContributor(address: string): Promise<Contributor> {
    return this.request<Contributor>(`/contributors/${address}`);
  }

  /** Submit work for a bounty */
  async submitWork(bountyId: string, prUrl: string, walletAddress: string): Promise<WorkSubmission> {
    return this.request<WorkSubmission>('/submissions', {
      method: 'POST',
      body: JSON.stringify({ bountyId, prUrl, submittedBy: walletAddress }),
    });
  }

  /** Get all submissions for a bounty */
  async getSubmissions(bountyId: string): Promise<WorkSubmission[]> {
    return this.request<WorkSubmission[]>(`/bounties/${bountyId}/submissions`);
  }

  /** Get submissions by contributor address */
  async getContributorSubmissions(address: string): Promise<WorkSubmission[]> {
    return this.request<WorkSubmission[]>(`/contributors/${address}/submissions`);
  }
}
