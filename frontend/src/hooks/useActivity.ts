import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/apiClient';
import type { ActivityEvent } from '../components/home/ActivityFeed';

interface ActivityResponse {
  items: ActivityEvent[];
}

async function fetchActivity(): Promise<ActivityEvent[]> {
  try {
    const response = await fetch('/api/activity', {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error('Activity API unavailable');
    const data = await response.json() as ActivityResponse | ActivityEvent[];
    if (Array.isArray(data)) return data;
    return data?.items ?? [];
  } catch {
    // Graceful fallback: return empty array so MOCK_EVENTS are used
    return [];
  }
}

export function useActivity() {
  return useQuery({
    queryKey: ['activity'],
    queryFn: fetchActivity,
    // Refetch every 30 seconds as per acceptance criteria
    refetchInterval: 30_000,
    // Don't retry on failure — graceful fallback is acceptable
    retry: false,
    staleTime: 20_000,
  });
}
