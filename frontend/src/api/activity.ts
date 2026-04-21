import { apiClient } from '../services/apiClient';

export type ActivityEventType = 'completed' | 'submitted' | 'posted' | 'review' | 'payout';

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  username: string;
  avatar_url?: string | null;
  detail: string;
  timestamp: string;
}

type RawActivityEvent = Partial<ActivityEvent> & {
  user?: string;
  actor?: string;
  actor_username?: string;
  avatar?: string | null;
  created_at?: string;
  occurred_at?: string;
  message?: string;
  description?: string;
  bounty_title?: string;
  amount?: number;
  token?: string;
};

function normalizeActivityEvent(event: RawActivityEvent, index: number): ActivityEvent {
  const timestamp = event.timestamp ?? event.created_at ?? event.occurred_at ?? new Date().toISOString();
  const username = event.username ?? event.actor_username ?? event.actor ?? event.user ?? 'SolFoundry';
  const amountDetail = event.amount && event.token ? `${event.amount.toLocaleString()} ${event.token}` : undefined;

  return {
    id: event.id ?? `${timestamp}-${index}`,
    type: event.type ?? 'posted',
    username,
    avatar_url: event.avatar_url ?? event.avatar ?? null,
    detail: event.detail ?? event.message ?? event.description ?? event.bounty_title ?? amountDetail ?? 'bounty activity',
    timestamp,
  };
}

export async function listActivityEvents(): Promise<ActivityEvent[]> {
  const response = await apiClient<RawActivityEvent[] | { items?: RawActivityEvent[]; events?: RawActivityEvent[] }>(
    '/api/activity',
    { retries: 1, timeoutMs: 8_000 },
  );

  const events = Array.isArray(response) ? response : response.items ?? response.events ?? [];

  return events.map(normalizeActivityEvent);
}
