import type {
  MarketplaceRepo,
  FundingGoal,
  Contribution,
  RepoLeaderboardEntry,
} from '../types/marketplace';

const BASE = '/api/marketplace';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json();
}

// ── Repos ──

export interface SearchReposParams {
  q?: string;
  language?: string;
  min_stars?: number;
  sort?: 'stars' | 'funded' | 'recent';
  page?: number;
  limit?: number;
}

export function searchRepos(params: SearchReposParams = {}): Promise<{ repos: MarketplaceRepo[]; total: number }> {
  const sp = new URLSearchParams();
  if (params.q) sp.set('q', params.q);
  if (params.language) sp.set('language', params.language);
  if (params.min_stars !== undefined) sp.set('min_stars', String(params.min_stars));
  if (params.sort) sp.set('sort', params.sort);
  if (params.page) sp.set('page', String(params.page));
  if (params.limit) sp.set('limit', String(params.limit));
  return request(`${BASE}/repos?${sp.toString()}`);
}

export function getRepoDetails(repoId: string): Promise<MarketplaceRepo> {
  return request(`${BASE}/repos/${repoId}`);
}

export function registerRepo(payload: { github_id: number }): Promise<MarketplaceRepo> {
  return request(`${BASE}/repos`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ── Funding Goals ──

export interface CreateFundingGoalPayload {
  repo_id: string;
  title: string;
  description: string;
  target_amount: number;
  target_token: 'USDC' | 'FNDRY';
  deadline?: string;
}

export function createFundingGoal(payload: CreateFundingGoalPayload): Promise<FundingGoal> {
  const { repo_id, ...body } = payload;
  return request(`${BASE}/repos/${repo_id}/funding-goals`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export interface ListFundingGoalsParams {
  repo_id?: string;
  status?: 'active' | 'completed' | 'cancelled';
  page?: number;
  limit?: number;
}

export function listFundingGoals(params: ListFundingGoalsParams = {}): Promise<{ goals: FundingGoal[]; total: number }> {
  const sp = new URLSearchParams();
  if (params.repo_id) sp.set('repo_id', params.repo_id);
  if (params.status) sp.set('status', params.status);
  if (params.page) sp.set('page', String(params.page));
  if (params.limit) sp.set('limit', String(params.limit));
  return request(`${BASE}/funding-goals?${sp.toString()}`);
}

export function getGoalProgress(goalId: string): Promise<FundingGoal & { contributions: Contribution[] }> {
  return request(`${BASE}/funding-goals/${goalId}`);
}

// ── Contributions ──

export interface ContributePayload {
  amount: number;
  token: 'USDC' | 'FNDRY';
  tx_signature?: string;
}

export function contributeToGoal(goalId: string, payload: ContributePayload): Promise<Contribution> {
  return request(`${BASE}/funding-goals/${goalId}/contribute`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function distributePayments(goalId: string): Promise<{ distributed: number; recipients: number }> {
  return request(`${BASE}/funding-goals/${goalId}/distribute`, {
    method: 'POST',
  });
}

// ── Leaderboard ──

export function getRepoLeaderboard(repoId: string, limit = 10): Promise<RepoLeaderboardEntry[]> {
  return request(`${BASE}/repos/${repoId}/leaderboard?limit=${limit}`);
}
