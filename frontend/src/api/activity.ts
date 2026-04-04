import { apiClient } from '../services/apiClient';
import type { ActivityEvent } from '../types/activity';

export async function getRecentActivity(limit = 10): Promise<ActivityEvent[]> {
  return apiClient<ActivityEvent[]>('/api/activity', {
    params: { limit },
  });
}
