import { useQuery } from '@tanstack/react-query';
import { apiClient, isApiError } from '../services/apiClient';
import type { ContributorProfile, CompletedBounty } from '../types/contributor';
import type { BountyTier } from '../types/bounty';

const VALID_TIERS: readonly string[] = ['T1', 'T2', 'T3'];

interface ContributorApiResponse {
  username: string;
  avatar_url?: string;
  joined_at?: string;
  created_at?: string;
  wallet_address?: string;
  tier?: string;
  bounties_completed?: number;
  completed_t1?: number;
  completed_t2?: number;
  completed_t3?: number;
  total_earned_fndry?: number;
  total_earned?: number;
  reputation_score?: number;
  recent_bounties?: Array<{
    id: string;
    title: string;
    tier?: string;
    completed_at?: string;
    reward?: number;
    currency?: string;
  }>;
}

function mapApiResponse(data: ContributorApiResponse): ContributorProfile {
  const tier = VALID_TIERS.includes(data.tier ?? '') ? (data.tier as BountyTier) : 'T1';
  const t1 = data.completed_t1 ?? 0;
  const t2 = data.completed_t2 ?? 0;
  const t3 = data.completed_t3 ?? 0;

  const recentBounties: CompletedBounty[] = Array.isArray(data.recent_bounties)
    ? data.recent_bounties.map((b) => ({
        id: String(b.id ?? ''),
        title: String(b.title ?? ''),
        tier: (VALID_TIERS.includes(b.tier ?? '') ? b.tier : 'T1') as BountyTier,
        completedAt: String(b.completed_at ?? ''),
        reward: Number(b.reward ?? 0),
        currency: String(b.currency ?? '$FNDRY'),
      }))
    : [];

  return {
    username: data.username,
    avatarUrl: data.avatar_url ?? `https://avatars.githubusercontent.com/${data.username}`,
    joinedAt: data.joined_at ?? data.created_at ?? '',
    walletAddress: data.wallet_address ?? '',
    tier,
    bountiesCompleted: data.bounties_completed ?? t1 + t2 + t3,
    completedT1: t1,
    completedT2: t2,
    completedT3: t3,
    totalEarnedFndry: data.total_earned_fndry ?? data.total_earned ?? 0,
    reputationScore: data.reputation_score ?? 0,
    recentBounties,
  };
}

export function useContributorProfile(username: string | undefined) {
  return useQuery({
    queryKey: ['contributor', username],
    queryFn: async () => {
      const data = await apiClient<ContributorApiResponse>(
        `/api/contributors/${encodeURIComponent(username!)}`,
        { retries: 1 },
      );
      return mapApiResponse(data);
    },
    enabled: Boolean(username),
    retry: false,
    staleTime: 30_000,
  });
}

export function useIsNotFound(error: unknown): boolean {
  return isApiError(error) && error.status === 404;
}
