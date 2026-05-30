import { useQuery } from '@tanstack/react-query';
import { listActivity } from '../api/activity';
import type { ActivityEvent } from '../api/activity';

const POLL_INTERVAL = 30_000; // 30 seconds

/**
 * Fetch recent activity events with automatic 30-second polling.
 * Returns `{ data, isLoading, isError }`.  `data` is empty when the
 * endpoint is unavailable — callers should fall back to mock data.
 */
export function useActivity(limit = 4) {
  return useQuery<ActivityEvent[]>({
    queryKey: ['activity', limit],
    queryFn: () => listActivity(limit),
    refetchInterval: POLL_INTERVAL,
    refetchIntervalInBackground: true,
    staleTime: POLL_INTERVAL,
    retry: false,
    placeholderData: [],
  });
}
