import { apiClient } from '../services/apiClient';

export interface ActivityEvent {
  id: string;
  type: 'completed' | 'submitted' | 'posted' | 'review';
  username: string;
  avatar_url?: string | null;
  detail: string;
  timestamp: string;
}

export interface ActivityResponse {
  events: ActivityEvent[];
}

/**
 * Fetch recent activity events.
 * Endpoint may return either an array directly, or an `{ events: [...] }` shape.
 */
export async function listActivity(limit = 10): Promise<ActivityEvent[]> {
  const response = await apiClient<ActivityEvent[] | ActivityResponse>('/api/activity', {
    params: { limit },
  });

  if (Array.isArray(response)) {
    return response;
  }
  if (response && typeof response === 'object' && Array.isArray((response as ActivityResponse).events)) {
    return (response as ActivityResponse).events;
  }
  return [];
}
