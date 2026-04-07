import { apiClient } from '../services/apiClient';
import type { ActivityEvent } from '../components/home/ActivityFeed';

export async function getActivity(): Promise<ActivityEvent[]> {
  try {
    const data = await apiClient<ActivityEvent[] | { events: ActivityEvent[] }>(
      '/api/activity',
    );
    // Support both flat array and wrapped shape
    if (Array.isArray(data)) return data;
    return (data as { events: ActivityEvent[] }).events ?? [];
  } catch {
    // Return empty on error — HomePage will fall back to MOCK_EVENTS
    return [];
  }
}
