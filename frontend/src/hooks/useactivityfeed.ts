/**
 * useActivityFeed — fetches the activity feed with 30-second auto-refresh.
 * Provides loading and error states so the component can render gracefully.
 * @module hooks/useActivityFeed
 */
import { useQuery } from '@tanstack/react-query';
import { getActivityFeed } from '../api/activity';

const REFETCH_INTERVAL_MS = 30_000;

export interface UseActivityFeedOptions {
  /** Number of events to fetch (default 10). */
  limit?: number;
  /** Override the auto-refresh interval in milliseconds. */
  refetchInterval?: number;
}

export function useActivityFeed(options: UseActivityFeedOptions = {}) {
  const { limit = 10, refetchInterval = REFETCH_INTERVAL_MS } = options;

  return useQuery({
    queryKey: ['activity-feed', limit],
    queryFn: () => getActivityFeed(limit),
    staleTime: refetchInterval,
    refetchInterval,
    retry: 2,
    // Don't refetch on window focus if data is still fresh
    refetchOnWindowFocus: false,
  });
}
