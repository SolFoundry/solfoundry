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

type RawActivityEvent = Partial<ActivityEvent> & {
  created_at?: string;
  message?: string;
  actor?: string;
  user?: string;
};

function normalizeActivityEvent(event: RawActivityEvent, index: number): ActivityEvent {
  return {
    id: event.id ?? `${event.type ?? 'activity'}-${event.timestamp ?? event.created_at ?? index}`,
    type: event.type ?? 'posted',
    username: event.username ?? event.actor ?? event.user ?? 'SolFoundry',
    avatar_url: event.avatar_url ?? null,
    detail: event.detail ?? event.message ?? 'updated a bounty',
    timestamp: event.timestamp ?? event.created_at ?? new Date().toISOString(),
  };
}

export async function listActivity(): Promise<ActivityEvent[]> {
  const response = await apiClient<ActivityEvent[] | { items?: RawActivityEvent[]; events?: RawActivityEvent[] }>(
    '/api/activity',
    { retries: 1 },
  );

  const events = Array.isArray(response)
    ? response
    : response.items ?? response.events ?? [];

  return events.map(normalizeActivityEvent);
}
