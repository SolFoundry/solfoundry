/**
 * Admin API client — all endpoints require admin auth
 */

const BASE_URL = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL
  ?? 'https://api.solfoundry.io';

// ── Types ─────────────────────────────────────────────────────────────────────

export type BountyStatus = 'draft' | 'open' | 'in_progress' | 'under_review' | 'completed' | 'cancelled' | 'disputed';
export type ContributorTier = 'T1' | 'T2' | 'T3';
export type ContributorStatus = 'active' | 'banned' | 'suspended' | 'pending_review';

export interface AdminBounty {
  id: string;
  issueNumber: number;
  title: string;
  description: string;
  reward: number;
  rewardToken: string;
  status: BountyStatus;
  tier: ContributorTier;
  tags: string[];
  issueUrl: string;
  createdAt: string;
  updatedAt: string;
  deadline?: string;
  claimedBy?: string;
  submissionsCount: number;
  prUrl?: string;
}

export interface AdminContributor {
  id: string;
  githubHandle: string;
  walletAddress?: string;
  email?: string;
  status: ContributorStatus;
  tier: ContributorTier;
  reputation: number;
  totalEarned: number;
  bountiesCompleted: number;
  bountiesInProgress: number;
  joinedAt: string;
  lastActiveAt: string;
  banReason?: string;
  notes?: string;
}

export interface TreasuryStats {
  totalBalance: number;
  rewardToken: string;
  pendingPayouts: number;
  paidOut: number;
  lockedInEscrow: number;
  lastUpdatedAt: string;
}

export interface AdminStats {
  pendingBounties: number;
  activeBounties: number;
  completedBounties: number;
  activeContributors: number;
  pendingSubmissions: number;
  openDisputes: number;
  treasury: TreasuryStats;
}

export interface CreateBountyInput {
  title: string;
  description: string;
  reward: number;
  rewardToken?: string;
  tier: ContributorTier;
  tags: string[];
  issueUrl: string;
  deadline?: string;
}

export interface UpdateBountyInput {
  title?: string;
  description?: string;
  reward?: number;
  status?: BountyStatus;
  tier?: ContributorTier;
  tags?: string[];
  deadline?: string;
}

export interface Pagination<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
}

// ── HTTP helpers ───────────────────────────────────────────────────────────────

async function adminFetch<T>(
  path: string,
  init: RequestInit = {},
  params?: Record<string, string | number>,
): Promise<T> {
  const url = new URL(`${BASE_URL}/admin${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  const token = localStorage.getItem('admin_token') ?? '';
  const res = await fetch(url.toString(), {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` })) as { message?: string };
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Admin Stats ────────────────────────────────────────────────────────────────
export const getAdminStats = () => adminFetch<AdminStats>('/stats');

// ── Bounties ──────────────────────────────────────────────────────────────────
export const getBounties = (p: { page?: number; status?: BountyStatus; search?: string } = {}) =>
  adminFetch<Pagination<AdminBounty>>('/bounties', {}, { page: p.page ?? 1, ...(p.status ? { status: p.status } : {}), ...(p.search ? { search: p.search } : {}) });

export const getBounty = (id: string) => adminFetch<AdminBounty>(`/bounties/${id}`);

export const createBounty = (data: CreateBountyInput) =>
  adminFetch<AdminBounty>('/bounties', { method: 'POST', body: JSON.stringify(data) });

export const updateBounty = (id: string, data: UpdateBountyInput) =>
  adminFetch<AdminBounty>(`/bounties/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const closeBounty = (id: string, reason?: string) =>
  adminFetch<AdminBounty>(`/bounties/${id}/close`, { method: 'POST', body: JSON.stringify({ reason }) });

// ── Contributors ──────────────────────────────────────────────────────────────
export const getContributors = (p: { page?: number; status?: ContributorStatus; search?: string } = {}) =>
  adminFetch<Pagination<AdminContributor>>('/contributors', {}, { page: p.page ?? 1, ...(p.status ? { status: p.status } : {}), ...(p.search ? { search: p.search } : {}) });

export const getContributor = (id: string) => adminFetch<AdminContributor>(`/contributors/${id}`);

export const approveContributor = (id: string) =>
  adminFetch<AdminContributor>(`/contributors/${id}/approve`, { method: 'POST' });

export const banContributor = (id: string, reason: string) =>
  adminFetch<AdminContributor>(`/contributors/${id}/ban`, { method: 'POST', body: JSON.stringify({ reason }) });

export const updateContributorNotes = (id: string, notes: string) =>
  adminFetch<AdminContributor>(`/contributors/${id}`, { method: 'PATCH', body: JSON.stringify({ notes }) });
