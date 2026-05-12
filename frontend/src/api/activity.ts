import { apiClient } from '../services/apiClient';

export interface ActivityEvent {
  id: string;
  type: 'completed' | 'submitted' | 'posted' | 'review';
  username: string;
  avatar_url?: string | null;
  detail: string;
  timestamp: string;
}

interface ActivityResponse {
  items: ActivityEvent[];
}

export async function listActivity(limit = 4): Promise<ActivityResponse> {
  return apiClient<ActivityResponse>('/api/activity', {
    params: { limit },
  });
}
