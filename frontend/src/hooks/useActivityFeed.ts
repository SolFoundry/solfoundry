import { useQuery } from '@tanstack/react-query';
import { getActivityEvents } from '../api/activity';

export function useActivityFeed(limit = 8, enabled = true) {
  return useQuery({
    queryKey: ['activity-feed', limit],
    queryFn: () => getActivityEvents({ limit }),
    enabled,
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: 1,
  });
}
