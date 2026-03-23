/**
 * React Query hooks for admin dashboard data.
 * All requests include a Bearer token from sessionStorage.
 * @module hooks/useAdminData
 */
import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { PublicKey } from '@solana/web3.js';
import type {
  AdminOverview,
  BountyListAdminResponse,
  BountyAdminUpdate,
  BountyAdminCreate,
  ContributorListAdminResponse,
  TierHistoryResponse,
  ReviewPipelineResponse,
  FinancialOverview,
  PayoutHistoryResponse,
  SystemHealthResponse,
  AuditLogResponse,
  TreasuryDashboardResponse,
} from '../types/admin';

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'sf_admin_token';

export function getAdminToken(): string {
  return sessionStorage.getItem(STORAGE_KEY) ?? '';
}

export function setAdminToken(token: string): void {
  if (token) {
    sessionStorage.setItem(STORAGE_KEY, token);
  } else {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}

export function clearAdminToken(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

// ---------------------------------------------------------------------------
// Base fetch helper
// ---------------------------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

async function adminFetch<T>(
  path: string,
  init?: RequestInit,
  opts?: { treasuryWallet?: string | null },
): Promise<T> {
  const token = getAdminToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers as Record<string, string>),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts?.treasuryWallet ? { 'X-SF-Treasury-Wallet': opts.treasuryWallet } : {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function parseTreasuryOwnerWallets(): string[] {
  const raw = import.meta.env.VITE_TREASURY_OWNER_WALLETS as string | undefined;
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

export function useTreasuryDashboard(publicKey: PublicKey | null) {
  const owners = useMemo(() => parseTreasuryOwnerWallets(), []);
  const walletHeader = publicKey?.toBase58() ?? null;
  const ownerOk =
    owners.length === 0 ||
    Boolean(walletHeader && owners.includes(walletHeader.toLowerCase()));
  const canFetch =
    Boolean(getAdminToken()) &&
    ownerOk &&
    (owners.length === 0 || Boolean(walletHeader));

  return useQuery<TreasuryDashboardResponse>({
    queryKey: ['admin', 'treasury', walletHeader ?? 'no-wallet'],
    queryFn: () =>
      adminFetch<TreasuryDashboardResponse>('/api/admin/treasury/dashboard', undefined, {
        treasuryWallet: owners.length ? walletHeader : null,
      }),
    enabled: canFetch,
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: false,
  });
}

export function useAdminOverview() {
  return useQuery<AdminOverview>({
    queryKey: ['admin', 'overview'],
    queryFn: () => adminFetch<AdminOverview>('/api/admin/overview'),
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: false,
  });
}

export function useAdminBounties(params: {
  page?: number;
  perPage?: number;
  search?: string;
  status?: string;
}) {
  const { page = 1, perPage = 20, search, status } = params;
  const qs = new URLSearchParams({ page: String(page), per_page: String(perPage) });
  if (search) qs.set('search', search);
  if (status) qs.set('status', status);

  return useQuery<BountyListAdminResponse>({
    queryKey: ['admin', 'bounties', page, perPage, search, status],
    queryFn: () => adminFetch<BountyListAdminResponse>(`/api/admin/bounties?${qs}`),
    staleTime: 10_000,
    retry: false,
  });
}

export function useUpdateBounty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, update }: { id: string; update: BountyAdminUpdate }) =>
      adminFetch<{ ok: boolean }>(`/api/admin/bounties/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(update),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'bounties'] }),
  });
}

export function useCloseBounty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      adminFetch<{ ok: string }>(`/api/admin/bounties/${id}/close`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'bounties'] });
      qc.invalidateQueries({ queryKey: ['admin', 'overview'] });
    },
  });
}

export function useAdminContributors(params: {
  page?: number;
  perPage?: number;
  search?: string;
  isBanned?: boolean;
}) {
  const { page = 1, perPage = 20, search, isBanned } = params;
  const qs = new URLSearchParams({ page: String(page), per_page: String(perPage) });
  if (search) qs.set('search', search);
  if (isBanned !== undefined) qs.set('is_banned', String(isBanned));

  return useQuery<ContributorListAdminResponse>({
    queryKey: ['admin', 'contributors', page, perPage, search, isBanned],
    queryFn: () => adminFetch<ContributorListAdminResponse>(`/api/admin/contributors?${qs}`),
    staleTime: 10_000,
    retry: false,
  });
}

export function useBanContributor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      adminFetch<{ ok: string }>(`/api/admin/contributors/${id}/ban`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'contributors'] });
      qc.invalidateQueries({ queryKey: ['admin', 'overview'] });
    },
  });
}

export function useUnbanContributor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      adminFetch<{ ok: string }>(`/api/admin/contributors/${id}/unban`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'contributors'] });
      qc.invalidateQueries({ queryKey: ['admin', 'overview'] });
    },
  });
}

export function useReviewPipeline() {
  return useQuery<ReviewPipelineResponse>({
    queryKey: ['admin', 'reviews'],
    queryFn: () => adminFetch<ReviewPipelineResponse>('/api/admin/reviews/pipeline'),
    refetchInterval: 20_000,
    staleTime: 10_000,
    retry: false,
  });
}

export function useFinancialOverview() {
  return useQuery<FinancialOverview>({
    queryKey: ['admin', 'financial', 'overview'],
    queryFn: () => adminFetch<FinancialOverview>('/api/admin/financial/overview'),
    staleTime: 30_000,
    retry: false,
  });
}

export function usePayoutHistory(page = 1, perPage = 20) {
  return useQuery<PayoutHistoryResponse>({
    queryKey: ['admin', 'financial', 'payouts', page, perPage],
    queryFn: () =>
      adminFetch<PayoutHistoryResponse>(
        `/api/admin/financial/payouts?page=${page}&per_page=${perPage}`,
      ),
    staleTime: 30_000,
    retry: false,
  });
}

export function useSystemHealth() {
  return useQuery<SystemHealthResponse>({
    queryKey: ['admin', 'system', 'health'],
    queryFn: () => adminFetch<SystemHealthResponse>('/api/admin/system/health'),
    refetchInterval: 15_000,
    staleTime: 10_000,
    retry: false,
  });
}

export function useAuditLog(limit = 50, eventFilter?: string) {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (eventFilter) qs.set('event', eventFilter);

  return useQuery<AuditLogResponse>({
    queryKey: ['admin', 'audit-log', limit, eventFilter],
    queryFn: () => adminFetch<AuditLogResponse>(`/api/admin/audit-log?${qs}`),
    refetchInterval: 15_000,
    staleTime: 5_000,
    retry: false,
  });
}

export function useCreateBounty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: BountyAdminCreate) =>
      adminFetch<{ ok: boolean; bounty_id: string }>('/api/admin/bounties', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'bounties'] });
      qc.invalidateQueries({ queryKey: ['admin', 'overview'] });
    },
  });
}

export function useContributorHistory(contributorId: string, limit = 50) {
  return useQuery<TierHistoryResponse>({
    queryKey: ['admin', 'contributors', contributorId, 'history'],
    queryFn: () =>
      adminFetch<TierHistoryResponse>(
        `/api/admin/contributors/${contributorId}/history?limit=${limit}`,
      ),
    staleTime: 30_000,
    retry: false,
    enabled: Boolean(contributorId),
  });
}

/** Re-export adminFetch for use in components that need direct fetch (e.g. CSV download). */
export { adminFetch };
