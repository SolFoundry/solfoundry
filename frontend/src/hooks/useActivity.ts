import { useQuery } from '@tanstack/react-query';
import { fetchActivity } from '../api/activity';
import type { ActivityEvent } from '../api/activity';

export function useActivity(limit = 10) {
  return useQuery<ActivityEvent[]>({
    queryKey: ['activity', limit],
    queryFn: () => fetchActivity(limit),
    refetchInterval: 30_000,   // auto-refresh every 30s
    staleTime: 20_000,
    retry: 1,
  });
}
