import { useQuery } from '@tanstack/react-query';
import { getProfileStats } from '../api/profile';
import type { ProfileStats } from '../api/profile';

interface ProfileStatsResult {
  stats: ProfileStats;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Hook to fetch contributor profile stats.
 */
export function useProfileStats(userId: string | null | undefined): ProfileStatsResult {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['profile-stats', userId],
    queryFn: () => getProfileStats(userId!),
    enabled: !!userId,
    staleTime: 60_000,
    retry: 1,
  });

  return {
    stats: data ?? {
      totalEarned: 0,
      earnedFndry: 0,
      earnedUsdc: 0,
      bountiesCompleted: 0,
      bountiesCreated: 0,
      submissionsMade: 0,
      contributionStreak: 0,
      topSkills: [],
      earningsHistory: [],
    },
    isLoading,
    isError,
  };
}