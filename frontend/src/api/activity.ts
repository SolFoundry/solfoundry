/**
 * Activity feed API — fetches recent platform events from GET /api/activity.
 * @module api/activity
 */
import { apiClient } from '../services/apiClient';

/** Activity event types matching the backend enum. */
export type ActivityEventType = 'completed' | 'submitted' | 'posted' | 'review';

/** Raw activity event shape returned by the backend. */
export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  username: string;
  avatar_url?: string | null;
  detail: string;
  timestamp: string;
}

export interface ActivityFeedResponse {
  items: ActivityEvent[];
  total: number;
}

/**
 * Fetch the recent activity feed.
 * Returns up to `limit` events ordered by timestamp descending.
 */
export async function getActivityFeed(limit = 10): Promise<ActivityEvent[]> {
  const response = await apiClient<ActivityFeedResponse | ActivityEvent[]>(
    '/api/activity',
    { params: { limit } },
  );
  if (Array.isArray(response)) return response;
  return response.items;
}
