import { useQuery } from '@tanstack/react-query';
import { listActivity } from '../api/activity';
import type { ActivityEvent } from '../api/activity';

export function useActivity() {
  return useQuery<ActivityEvent[]>({
    queryKey: ['activity'],
    queryFn: () => listActivity(10),
    refetchInterval: 30_000,
    staleTime: 30_000,
    retry: 1,
  });
}