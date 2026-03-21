import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import type { LeaderboardEntry } from '../types/api';

export type TimeRange = '7d' | '30d' | '90d' | 'all';

export const fetchLeaderboard = async (
  range: TimeRange = 'all',
  limit: number = 20
): Promise<LeaderboardEntry[]> => {
  const { data } = await api.get<LeaderboardEntry[]>('/leaderboard', {
    params: { range, limit },
  });
  return data;
};

export function useLeaderboard(range: TimeRange = 'all', limit: number = 20) {
  const {
    data: contributors = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['leaderboard', range, limit],
    queryFn: () => fetchLeaderboard(range, limit),
  });

  return {
    contributors,
    loading: isLoading,
    error: error instanceof Error ? error.message : null,
    refetch,
  };
}
