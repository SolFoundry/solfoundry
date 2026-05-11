import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchActivity, type ActivityEvent } from '../api/activity';

interface UseActivityFeedOptions {
  refreshIntervalMs?: number; // default 30000
  maxEvents?: number; // default 50
}

interface UseActivityFeedResult {
  events: ActivityEvent[];
  isLoading: boolean;
  isError: boolean;
  error: string | null;
  refetch: () => void;
}

export function useActivityFeed({
  refreshIntervalMs = 30000,
  maxEvents = 50,
}: UseActivityFeedOptions = {}): UseActivityFeedResult {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const fetchEvents = useCallback(async () => {
    try {
      const data = await fetchActivity();
      setEvents(data.events.slice(0, maxEvents));
      setIsError(false);
      setError(null);
    } catch (err) {
      // Graceful fallback: keep existing data, mark as stale
      setIsError(true);
      setError(err instanceof Error ? err.message : 'Failed to fetch activity');
    } finally {
      setIsLoading(false);
    }
  }, [maxEvents]);

  // Initial fetch + auto-refresh
  useEffect(() => {
    fetchEvents();
    intervalRef.current = setInterval(fetchEvents, refreshIntervalMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchEvents, refreshIntervalMs]);

  // Manual refetch
  const refetch = useCallback(() => {
    setIsLoading(true);
    fetchEvents();
  }, [fetchEvents]);

  return { events, isLoading, isError, error, refetch };
}
