import { apiClient } from '../services/apiClient';

export interface ActivityEvent {
  id: string;
  type: 'completed' | 'submitted' | 'posted' | 'review';
  username: string;
  avatar_url?: string | null;
  detail: string;
  timestamp: string;
}

type RawActivity = Record<string, unknown>;

function mapType(raw: string): ActivityEvent['type'] {
  const value = raw.toLowerCase();
  if (value.includes('complete') || value.includes('payout')) return 'completed';
  if (value.includes('submit') || value.includes('pr')) return 'submitted';
  if (value.includes('review')) return 'review';
  return 'posted';
}

function mapItem(item: RawActivity, index: number): ActivityEvent {
  const actor = (item.username ?? item.user ?? item.actor ?? item.author ?? 'Unknown') as string;
  const detail = (item.detail ?? item.message ?? item.description ?? item.title ?? 'Activity update') as string;
  const typeRaw = (item.type ?? item.event_type ?? item.kind ?? 'posted') as string;
  const timestamp = (item.timestamp ?? item.created_at ?? item.time ?? new Date().toISOString()) as string;
  const id = String(item.id ?? item.event_id ?? `${typeRaw}-${actor}-${index}-${timestamp}`);

  return {
    id,
    type: mapType(typeRaw),
    username: String(actor),
    avatar_url: (item.avatar_url ?? item.avatar ?? null) as string | null,
    detail: String(detail),
    timestamp: String(timestamp),
  };
}

export async function listActivity(): Promise<ActivityEvent[]> {
  const response = await apiClient<RawActivity[] | { items?: RawActivity[]; events?: RawActivity[] }>('/api/activity');
  const rows = Array.isArray(response) ? response : (response.items ?? response.events ?? []);
  return rows.map((item, i) => mapItem(item, i));
}
