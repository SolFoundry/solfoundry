/**
 * useBoost — data fetching and mutation for bounty reward boosts.
 *
 * Provides:
 *   - boost history list
 *   - booster leaderboard
 *   - boost summary (original + total)
 *   - submit boost mutation
 *
 * @module hooks/useBoost
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/apiClient';
import type {
  Boost,
  BoostListResponse,
  BoostLeaderboardResponse,
  BoostSummary,
  BoostRequest,
} from '../types/boost';

const MIN_BOOST = 1_000;

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

async function fetchBoosts(bountyId: string): Promise<BoostListResponse> {
  return apiClient<BoostListResponse>(`/api/bounties/${bountyId}/boosts`, {
    params: { limit: '50' },
    retries: 1,
  });
}

async function fetchLeaderboard(bountyId: string): Promise<BoostLeaderboardResponse> {
  return apiClient<BoostLeaderboardResponse>(
    `/api/bounties/${bountyId}/boost-leaderboard`,
    { retries: 1 },
  );
}

async function postBoost(bountyId: string, body: BoostRequest): Promise<Boost> {
  return apiClient<Boost>(`/api/bounties/${bountyId}/boost`, {
    method: 'POST',
    body: JSON.stringify(body),
    retries: 0,
  });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBoost(bountyId: string, originalAmount: number) {
  const qc = useQueryClient();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Boost history
  const {
    data: boostData,
    isLoading: boostsLoading,
  } = useQuery({
    queryKey: ['boosts', bountyId],
    queryFn: () => fetchBoosts(bountyId),
    staleTime: 30_000,
    enabled: Boolean(bountyId),
  });

  // Leaderboard
  const {
    data: leaderboardData,
    isLoading: leaderboardLoading,
  } = useQuery({
    queryKey: ['boost-leaderboard', bountyId],
    queryFn: () => fetchLeaderboard(bountyId),
    staleTime: 30_000,
    enabled: Boolean(bountyId),
  });

  // Derived boost summary
  const totalBoosted = boostData?.total_boosted ?? 0;
  const summary: BoostSummary = {
    original_amount: originalAmount,
    total_boosted: totalBoosted,
    total_amount: originalAmount + totalBoosted,
    boost_count: boostData?.total ?? 0,
  };

  // Submit mutation
  const mutation = useMutation({
    mutationFn: (body: BoostRequest) => postBoost(bountyId, body),
    onSuccess: () => {
      setSubmitError(null);
      setSubmitSuccess(true);
      qc.invalidateQueries({ queryKey: ['boosts', bountyId] });
      qc.invalidateQueries({ queryKey: ['boost-leaderboard', bountyId] });
    },
    onError: (err: Error) => {
      setSubmitError(err.message ?? 'Boost failed');
      setSubmitSuccess(false);
    },
  });

  function submitBoost(wallet: string, amount: number, txHash?: string) {
    if (amount < MIN_BOOST) {
      setSubmitError(`Minimum boost is ${MIN_BOOST.toLocaleString()} $FNDRY`);
      return;
    }
    setSubmitError(null);
    setSubmitSuccess(false);
    mutation.mutate({ booster_wallet: wallet, amount, tx_hash: txHash });
  }

  return {
    boosts: boostData?.boosts ?? [],
    leaderboard: leaderboardData?.leaderboard ?? [],
    summary,
    loading: boostsLoading || leaderboardLoading,
    submitting: mutation.isPending,
    submitError,
    submitSuccess,
    submitBoost,
    MIN_BOOST,
  };
}
