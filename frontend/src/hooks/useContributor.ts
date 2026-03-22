/**
 * useContributor - React Query powered hook for contributor profile data.
 * Fetches from real API with caching, loading states, and error handling.
 * @module hooks/useContributor
 */

import { useQuery } from '@tanstack/react-query';
import type { Contributor } from '../types/leaderboard';
import { fetchContributorByUsername } from '../api/contributors';

export interface UseContributorOptions {
  username: string;
  enabled?: boolean;
}

export interface ContributorProfile extends Contributor {
  id: string;
  bio?: string;
  walletAddress?: string;
  badges?: string[];
  tier?: number;
}

/**
 * Hook for fetching a contributor's profile by username.
 * Returns null if the contributor is not found or API fails.
 */
export function useContributor({ username, enabled = true }: UseContributorOptions) {
  const {
    data: contributor,
    isLoading,
    error,
    refetch,
  } = useQuery<ContributorProfile | null>({
    queryKey: ['contributor', username],
    queryFn: () => fetchContributorByUsername(username) as Promise<ContributorProfile | null>,
    staleTime: 60 * 1000,
    retry: 2,
    enabled: enabled && Boolean(username),
  });

  return {
    contributor,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}

export default useContributor;