import { useQuery } from '@tanstack/react-query';
import { getRecentActivity } from '../api/activity';

export function useActivity() {
  return useQuery({
    queryKey: ['recent-activity'],
    queryFn: getRecentActivity,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
