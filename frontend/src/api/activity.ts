import { apiClient } from '../services/apiClient';

export interface ActivityEvent {
  id: string;
  type: 'completed' | 'submitted' | 'posted' | 'review';
  username: string;
  avatar_url?: string | null;
  detail: string;
  timestamp: string;
}

export async function listActivity(limit?: number): Promise<ActivityEvent[]> {
  const params = limit ? { limit } : {};
  return apiClient.get<ActivityEvent[]>('/activity', { params });
}