import { useQuery } from '@tanstack/react-query';
import { listActivityEvents } from '../api/activity';

export function useActivityFeed() {
  return useQuery({
    queryKey: ['activity-feed'],
    queryFn: listActivityEvents,
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: 1,
  });
}
