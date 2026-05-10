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
  actor?: string | null;
  actor_username?: string | null;
  created_at?: string | null;
  message?: string | null;
  amount?: number | string | null;
  reward_token?: string | null;
  bounty_id?: string | number | null;
  pr_url?: string | null;
  score?: number | string | null;
};

interface ActivityListResponse {
  items?: RawActivityEvent[];
  events?: RawActivityEvent[];
}

function normalizeType(type: RawActivityEvent['type']): ActivityEventType {
  if (type === 'completed' || type === 'submitted' || type === 'posted' || type === 'review' || type === 'payout') {
    return type;
  }
  return 'posted';
}

function formatDetail(event: RawActivityEvent): string {
  if (event.detail) return event.detail;
  if (event.message) return event.message;

  const bountyLabel = event.bounty_id ? `Bounty #${event.bounty_id}` : 'a bounty';
  const amount = event.amount != null ? `${event.amount} ${event.reward_token ?? 'FNDRY'}` : null;

  switch (normalizeType(event.type)) {
    case 'completed':
    case 'payout':
      return amount ? `${amount} from ${bountyLabel}` : bountyLabel;
    case 'submitted':
      return event.pr_url ? `PR to ${bountyLabel}` : bountyLabel;
    case 'review':
      return event.score != null ? `${bountyLabel} - ${event.score}/10` : bountyLabel;
    case 'posted':
    default:
      return amount ? `${bountyLabel} - ${amount}` : bountyLabel;
  }
}

function normalizeActivityEvent(event: RawActivityEvent, index: number): ActivityEvent {
  const timestamp = event.timestamp ?? event.created_at ?? new Date().toISOString();
  return {
    id: event.id ?? `${timestamp}-${index}`,
    type: normalizeType(event.type),
    username: event.username ?? event.actor_username ?? event.actor ?? 'SolFoundry',
    avatar_url: event.avatar_url ?? null,
    detail: formatDetail(event),
    timestamp,
  };
}

export async function listActivity(): Promise<ActivityEvent[]> {
  const response = await apiClient<ActivityListResponse | RawActivityEvent[]>('/api/analytics/activity', {
    retries: 1,
    timeoutMs: 10_000,
  });

  const events = Array.isArray(response) ? response : response.items ?? response.events ?? [];
  return events.map(normalizeActivityEvent);
}
