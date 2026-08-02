import { apiClient } from '../services/apiClient';

/** One activity event as returned by the backend activity endpoint. */
export interface ActivityEvent {
  id: string;
  type: 'completed' | 'submitted' | 'posted' | 'review';
  username: string;
  avatar_url?: string | null;
  detail: string;
  timestamp: string;
}

/** Activity API response shape. */
export interface ActivityListResponse {
  events: ActivityEvent[];
  total?: number;
}

/** Raw event form that may arrive in newer/smaller API responses. */
type RawActivityEvent = Partial<ActivityEvent> & { id: string; detail?: string; timestamp?: string };

function normalizeEvent(raw: RawActivityEvent): ActivityEvent {
  const type = ['completed', 'submitted', 'posted', 'review'].includes(raw.type as ActivityEvent['type'])
    ? raw.type as ActivityEvent['type']
    : 'submitted';
  return {
    id: String(raw.id),
    type,
    username: String(raw.username ?? 'SolFoundry'),
    avatar_url: raw.avatar_url ?? null,
    detail: String(raw.detail ?? ''),
    timestamp: String(raw.timestamp ?? new Date().toISOString()),
  };
}

/**
 * Fetch real homepage activity data from the backend.
 * Supports both `/api/activity` and `/api/events/activity`, and normalizes
 * slightly different payload shapes from the API.
 */
export async function listActivity(params?: { limit?: number }): Promise<ActivityEvent[]> {
  const response = await apiClient<ActivityListResponse | ActivityEvent[] | { items?: ActivityEvent[] }>(
    '/api/activity',
    {
      params: params as Record<string, string | number | boolean | undefined>,
      timeoutMs: 8_000,
    },
  );

  let rawEvents: RawActivityEvent[] = [];

  if (Array.isArray(response)) {
    rawEvents = response as RawActivityEvent[];
  } else if ('events' in response && Array.isArray(response.events)) {
    rawEvents = response.events;
  } else if ('items' in response && Array.isArray(response.items)) {
    rawEvents = response.items;
  }

  const limit = typeof params?.limit === 'number' ? Math.max(1, params.limit) : undefined;
  return rawEvents.map(normalizeEvent).slice(0, limit ?? 20);
}
