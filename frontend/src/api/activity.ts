import { apiClient } from '../services/apiClient';

export interface ActivityEvent {
  id: string;
  type: 'completed' | 'submitted' | 'posted' | 'review';
  username: string;
  avatar_url?: string | null;
  detail: string;
  timestamp: string;
}

export async function fetchActivity(limit = 10): Promise<ActivityEvent[]> {
  const data = await apiClient<ActivityEvent[] | { items: ActivityEvent[] }>(
    `/api/activity?limit=${limit}`
  );
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && 'items' in data) return data.items;
  return [];
}
