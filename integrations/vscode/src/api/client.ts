import * as vscode from 'vscode';
import { getApiBaseUrl } from '../utils/auth';
import type { Bounty, Submission, BountyFilters, ApiResponse } from '../types';

export class ApiClient {
  private baseUrl: string;
  private getApiKey: () => Promise<string | undefined>;

  constructor(getApiKey: () => Promise<string | undefined>) {
    this.getApiKey = getApiKey;
    this.baseUrl = getApiBaseUrl();
  }

  private refreshBaseUrl(): void {
    this.baseUrl = getApiBaseUrl();
  }

  private async headers(): Promise<Record<string, string>> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    const key = await this.getApiKey();
    if (key) {
      h['Authorization'] = `Bearer ${key}`;
    }
    return h;
  }

  async listBounties(filters?: BountyFilters): Promise<ApiResponse<Bounty[]>> {
    this.refreshBaseUrl();
    const qs = filters
      ? new URLSearchParams(
          Object.entries(filters).flatMap(([k, v]) =>
            Array.isArray(v) ? v.map(val => [k, String(val)]) : v ? [[k, String(v)]] : []
          )
        ).toString()
      : '';
    const url = `${this.baseUrl}/api/bounties${qs ? `?${qs}` : ''}`;
    const res = await fetch(url, { headers: await this.headers() });
    if (!res.ok) {
      throw new Error(`Failed to fetch bounties: ${res.status} ${res.statusText}`);
    }
    const json = await res.json();
    // Support both array and wrapped response
    if (Array.isArray(json)) {
      return { data: json, total: json.length };
    }
    return json as ApiResponse<Bounty[]>;
  }

  async getBounty(id: string): Promise<Bounty> {
    this.refreshBaseUrl();
    const res = await fetch(`${this.baseUrl}/api/bounties/${id}`, {
      headers: await this.headers(),
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch bounty ${id}: ${res.status}`);
    }
    return res.json() as Promise<Bounty>;
  }

  async listSubmissions(bountyId: string): Promise<Submission[]> {
    this.refreshBaseUrl();
    const res = await fetch(`${this.baseUrl}/api/bounties/${bountyId}/submissions`, {
      headers: await this.headers(),
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch submissions: ${res.status}`);
    }
    const json = await res.json();
    return Array.isArray(json) ? json : json.data ?? [];
  }

  async claimBounty(bountyId: string, notes?: string): Promise<unknown> {
    this.refreshBaseUrl();
    const res = await fetch(`${this.baseUrl}/api/bounties/${bountyId}/claim`, {
      method: 'POST',
      headers: await this.headers(),
      body: JSON.stringify({ notes }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Failed to claim bounty: ${res.status} - ${body}`);
    }
    return res.json();
  }
}
