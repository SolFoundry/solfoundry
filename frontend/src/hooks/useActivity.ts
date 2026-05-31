import { useQuery } from '@tanstack/react-query';
import { listActivity } from '../api/activity';

const REFRESH_INTERVAL = 30_000; // 30 seconds

export function useActivity(limit = 10) {
  return useQuery({
    queryKey: ['activity', limit],
    queryFn: () => listActivity(limit),
    staleTime: 15_000,
    refetchInterval: REFRESH_INTERVAL,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
