/**
 * React Query hooks for staking API data.
 * Covers position, history, stats, and all mutation operations.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/apiClient';
import type { StakingPosition, StakingHistory, StakingStats } from '../types/staking';

const POSITION_KEY = (wallet: string) => ['staking', 'position', wallet];
const HISTORY_KEY = (wallet: string) => ['staking', 'history', wallet];
const STATS_KEY = ['staking', 'stats'];

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useStakingPosition(wallet: string | null) {
  return useQuery<StakingPosition>({
    queryKey: POSITION_KEY(wallet ?? ''),
    queryFn: () => apiClient<StakingPosition>(`/api/staking/position/${wallet}`),
    enabled: !!wallet,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useStakingHistory(wallet: string | null, limit = 50, offset = 0) {
  return useQuery<StakingHistory>({
    queryKey: [...HISTORY_KEY(wallet ?? ''), limit, offset],
    queryFn: () =>
      apiClient<StakingHistory>(
        `/api/staking/history/${wallet}?limit=${limit}&offset=${offset}`,
      ),
    enabled: !!wallet,
    staleTime: 30_000,
  });
}

export function useStakingStats() {
  return useQuery<StakingStats>({
    queryKey: STATS_KEY,
    queryFn: () => apiClient<StakingStats>('/api/staking/stats'),
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useRecordStake(wallet: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { amount: number; signature: string }) =>
      apiClient<StakingPosition>('/api/staking/stake', {
        method: 'POST',
        body: JSON.stringify({ wallet_address: wallet, ...params }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: POSITION_KEY(wallet) });
      qc.invalidateQueries({ queryKey: HISTORY_KEY(wallet) });
      qc.invalidateQueries({ queryKey: STATS_KEY });
    },
  });
}

export function useInitiateUnstake(wallet: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (amount: number) =>
      apiClient<StakingPosition>('/api/staking/unstake/initiate', {
        method: 'POST',
        body: JSON.stringify({ wallet_address: wallet, amount }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: POSITION_KEY(wallet) });
      qc.invalidateQueries({ queryKey: HISTORY_KEY(wallet) });
    },
  });
}

export function useCompleteUnstake(wallet: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (signature: string) =>
      apiClient<StakingPosition>('/api/staking/unstake/complete', {
        method: 'POST',
        body: JSON.stringify({ wallet_address: wallet, signature }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: POSITION_KEY(wallet) });
      qc.invalidateQueries({ queryKey: HISTORY_KEY(wallet) });
      qc.invalidateQueries({ queryKey: STATS_KEY });
    },
  });
}

export function useClaimRewards(wallet: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient<{ amount_claimed: number; position: StakingPosition }>('/api/staking/claim', {
        method: 'POST',
        body: JSON.stringify({ wallet_address: wallet }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: POSITION_KEY(wallet) });
      qc.invalidateQueries({ queryKey: HISTORY_KEY(wallet) });
      qc.invalidateQueries({ queryKey: STATS_KEY });
    },
  });
}
