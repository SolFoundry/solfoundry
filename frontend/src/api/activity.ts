import { apiClient } from '../services/apiClient';

export type ActivityEventType = 'completed' | 'submitted' | 'posted' | 'review';

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  username: string;
  avatar_url?: string | null;
  detail: string;
  timestamp: string;
}

function isActivityEvent(value: unknown): value is ActivityEvent {
  if (typeof value !== 'object' || value === null) return false;
  const event = value as Record<string, unknown>;
  return (
    typeof event.id === 'string' &&
    typeof event.type === 'string' &&
    ['completed', 'submitted', 'posted', 'review'].includes(event.type) &&
    typeof event.username === 'string' &&
    typeof event.detail === 'string' &&
    typeof event.timestamp === 'string'
  );
}

function normalizeActivityResponse(response: ActivityEvent[] | { items?: ActivityEvent[]; events?: ActivityEvent[] }): ActivityEvent[] {
  if (Array.isArray(response)) return response.filter(isActivityEvent);

  const events = response.events ?? response.items ?? [];
  return events.filter(isActivityEvent);
}

export async function listActivity(limit = 4): Promise<ActivityEvent[]> {
  const response = await apiClient<ActivityEvent[] | { items?: ActivityEvent[]; events?: ActivityEvent[] }>('/api/activity', {
    params: { limit },
    retries: 1,
  });

  return normalizeActivityResponse(response);
}
