import { apiClient } from '../services/apiClient';

export interface ActivityEvent {
  id: string;
  type: 'completed' | 'submitted' | 'posted' | 'review' | 'payout';
  username: string;
  avatar_url?: string | null;
  detail: string;
  timestamp: string;
}

function normalizeType(type?: string): ActivityEvent['type'] {
  switch (type) {
    case 'completed':
    case 'submitted':
    case 'posted':
    case 'review':
    case 'payout':
      return type;
    default:
      return 'posted';
  }
}

function mapEvent(raw: Record<string, unknown>, index: number): ActivityEvent {
  return {
    id: String(raw.id ?? `activity-${index}`),
    type: normalizeType(String(raw.type ?? raw.event_type ?? 'posted')),
    username: String(raw.username ?? raw.actor_username ?? raw.user ?? 'Unknown'),
    avatar_url: (raw.avatar_url as string | null | undefined) ?? (raw.actor_avatar_url as string | null | undefined) ?? null,
    detail: String(raw.detail ?? raw.message ?? raw.summary ?? 'Activity updated'),
    timestamp: String(raw.timestamp ?? raw.created_at ?? raw.occurred_at ?? new Date().toISOString()),
  };
}

export async function getRecentActivity(): Promise<ActivityEvent[]> {
  const response = await apiClient<ActivityEvent[] | { items?: Record<string, unknown>[]; events?: Record<string, unknown>[] }>('/api/activity');

  if (Array.isArray(response)) {
    return response.map((item, index) => mapEvent(item as unknown as Record<string, unknown>, index));
  }

  const items = response.items ?? response.events ?? [];
  return items.map((item, index) => mapEvent(item, index));
}
