import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import type { Contributor, TimeRange } from '../types/leaderboard';

export const fetchLeaderboard = async (
  range: TimeRange = 'all',
  limit: number = 20
): Promise<Contributor[]> => {
  const { data } = await api.get<Contributor[]>('/leaderboard', {
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
