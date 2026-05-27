import { apiClient } from '../services/apiClient';

export interface ActivityEvent {
  id: string;
  type: 'completed' | 'submitted' | 'posted' | 'review';
  username: string;
  avatar_url?: string | null;
  detail: string;
  timestamp: string;
}

export async function getActivityFeed(): Promise<ActivityEvent[]> {
  try {
    const data = await apiClient<{ items: ActivityEvent[] } | ActivityEvent[]>('/api/activity');
    // Handle both { items: [...] } and direct array responses
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    return [];
  } catch {
    // API unavailable — return empty array, caller handles fallback
    return [];
  }
}
