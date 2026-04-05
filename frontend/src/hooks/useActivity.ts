import { useQuery } from '@tanstack/react-query';
import { getRecentActivity } from '../api/activity';

export function useActivity(limit = 10) {
  return useQuery({
    queryKey: ['activity', limit],
    queryFn: () => getRecentActivity(limit),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
