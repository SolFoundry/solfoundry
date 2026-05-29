import { useQuery } from '@tanstack/react-query';
import { getActivityFeed } from '../api/activity';

export function useActivityFeed() {
  return useQuery({
    queryKey: ['activity-feed'],
    queryFn: getActivityFeed,
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: false,
  });
}
