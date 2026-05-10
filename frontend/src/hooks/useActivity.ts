import { useQuery } from '@tanstack/react-query';
import { listActivity } from '../api/activity';

export function useActivity() {
  return useQuery({
    queryKey: ['activity'],
    queryFn: listActivity,
    refetchInterval: 30_000,
    staleTime: 30_000,
  });
}
