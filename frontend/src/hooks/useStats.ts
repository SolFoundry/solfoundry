import { useQuery } from '@tanstack/react-query';
import { getPlatformStats } from '../api/stats';

export function useStats() {
  return useQuery({
    queryKey: ['platform-stats'],
    queryFn: getPlatformStats,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}
