import { useQuery } from '@tanstack/react-query';
import { getLeaderboard } from '../api/leaderboard';
import type { TimePeriod } from '../types/leaderboard';

export function useLeaderboard(period: TimePeriod = 'all') {
  return useQuery({
    queryKey: ['leaderboard', period],
    queryFn: () => getLeaderboard(period),
    staleTime: 60_000,
  });
}
