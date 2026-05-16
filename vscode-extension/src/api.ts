import * as vscode from 'vscode';
import { Bounty, BountyListResponse, BountySearchParams, BountySearchResponse, FilterState } from './types';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function getConfig(): { apiUrl: string; accessToken: string } {
  const config = vscode.workspace.getConfiguration('solfoundry');
  return {
    apiUrl: config.get<string>('apiUrl', 'https://solfoundry.xyz'),
    accessToken: config.get<string>('accessToken', ''),
  };
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const { apiUrl, accessToken } = getConfig();
  const url = endpoint.startsWith('http') ? endpoint : `${apiUrl}${endpoint}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = response.statusText;
    let code: string | undefined;
    try {
      const errorData = await response.json();
      message = errorData.message || errorData.detail || message;
      code = errorData.code;
    } catch {
      // ignore JSON parse errors
    }
    throw new ApiError(response.status, message, code);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return response.json() as Promise<T>;
}

export async function listBounties(params?: {
  status?: string;
  limit?: number;
  offset?: number;
  tier?: string;
  reward_token?: string;
}): Promise<BountyListResponse> {
  const queryParams = new URLSearchParams();
  if (params?.status) queryParams.set('status', params.status);
  if (params?.limit) queryParams.set('limit', String(params.limit));
  if (params?.offset) queryParams.set('offset', String(params.offset));
  if (params?.tier) queryParams.set('tier', params.tier);
  if (params?.reward_token) queryParams.set('reward_token', params.reward_token);

  const query = queryParams.toString();
  const endpoint = query ? `/api/bounties?${query}` : '/api/bounties';
  return apiRequest<BountyListResponse | Bounty[]>(endpoint).then((response) => {
    if (Array.isArray(response)) {
      return { items: response, total: response.length, limit: params?.limit ?? 20, offset: params?.offset ?? 0 };
    }
    return response;
  });
}

export async function searchBounties(params: BountySearchParams): Promise<BountySearchResponse> {
  const queryParams = new URLSearchParams();
  if (params.q) queryParams.set('q', params.q);
  if (params.status) queryParams.set('status', params.status);
  if (params.tier) queryParams.set('tier', params.tier);
  if (params.category) queryParams.set('category', params.category);
  if (params.reward_min) queryParams.set('reward_min', String(params.reward_min));
  if (params.reward_max) queryParams.set('reward_max', String(params.reward_max));
  if (params.skills?.length) queryParams.set('skills', params.skills.join(','));
  if (params.sort) queryParams.set('sort', params.sort);
  if (params.page) queryParams.set('page', String(params.page));
  if (params.per_page) queryParams.set('per_page', String(params.per_page));

  const query = queryParams.toString();
  const endpoint = query ? `/api/bounties/search?${query}` : '/api/bounties/search';
  return apiRequest<BountySearchResponse>(endpoint);
}

export function filterBounties(bounties: Bounty[], filters: FilterState): Bounty[] {
  return bounties.filter((bounty) => {
    // Language filter (by skills)
    if (filters.language && filters.language !== 'all') {
      const langMatch = bounty.skills.some((skill) =>
        skill.toLowerCase().includes(filters.language.toLowerCase())
      );
      if (!langMatch) return false;
    }

    // Reward filter
    if (filters.rewardMin > 0 && bounty.reward_amount < filters.rewardMin) return false;
    if (filters.rewardMax > 0 && bounty.reward_amount > filters.rewardMax) return false;

    // Tier filter
    if (filters.tier && filters.tier !== 'all' && bounty.tier !== filters.tier) return false;

    // Status filter
    if (filters.status && filters.status !== 'all' && bounty.status !== filters.status) return false;

    return true;
  });
}

export const PROGRAMMING_LANGUAGES = [
  'all',
  'rust',
  'typescript',
  'javascript',
  'python',
  'solidity',
  'go',
  'java',
  'c++',
  'c#',
];

export const TIERS = ['all', 'T1', 'T2', 'T3'];

export const STATUSES = ['all', 'open', 'in_review', 'completed', 'cancelled', 'funded'];
