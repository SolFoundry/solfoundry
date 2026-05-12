import { useQuery } from '@tanstack/react-query';
import { listActivity } from '../api/activity';

export function useActivity(limit = 4) {
  return useQuery({
    queryKey: ['activity', limit],
    queryFn: () => listActivity(limit),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}
