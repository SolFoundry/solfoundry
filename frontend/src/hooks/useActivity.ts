import { useQuery } from '@tanstack/react-query';
import { listActivity } from '../api/activity';

export function useActivity() {
  return useQuery({
    queryKey: ['activity-feed'],
    queryFn: listActivity,
    staleTime: 20_000,
    refetchInterval: 30_000,
  });
}
