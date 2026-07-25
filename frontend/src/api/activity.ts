/**
 * Activity feed API — fetches real-time events from the backend.
 * Falls back to mock data when the API is unavailable.
 */
import { apiClient } from './apiClient';

export interface ActivityEvent {
  id: string;
  type: 'completed' | 'submitted' | 'posted' | 'review';
  username: string;
  avatar_url?: string | null;
  detail: string;
  timestamp: string;
}

export interface ActivityResponse {
  items: ActivityEvent[];
  total: number;
}

/**
 * Fetch recent activity events from the backend.
 * Returns null if the API is unavailable (graceful degradation).
 */
export async function fetchActivity(limit: number = 10): Promise<ActivityEvent[] | null> {
  try {
    const response = await apiClient<ActivityResponse>('/api/activity', {
      method: 'GET',
      params: { limit },
      retries: 1,
      timeoutMs: 5000,
    });
    return response?.items ?? null;
  } catch {
    // API unavailable — caller should use mock data
    return null;
  }
}