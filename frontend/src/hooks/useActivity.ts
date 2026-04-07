import { useQuery } from '@tanstack/react-query';
import { getActivity } from '../api/activity';

const POLL_INTERVAL_MS = 30_000;

export function useActivity() {
  return useQuery({
    queryKey: ['activity'],
    queryFn: getActivity,
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: POLL_INTERVAL_MS,
    retry: 1,
  });
}
