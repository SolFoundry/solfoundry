import { apiClient } from '../services/apiClient';

export interface ActivityEvent {
  id: string;
  type: 'completed' | 'submitted' | 'posted' | 'review';
  username: string;
  avatar_url?: string | null;
  detail: string;
  timestamp: string;
}

export interface ActivityResponse {
  events: ActivityEvent[];
}

/**
 * Fetch recent activity events from the backend.
 * Returns an empty array if the endpoint is unavailable (graceful fallback).
 */
export async function listActivity(limit = 4): Promise<ActivityEvent[]> {
  try {
    const response = await apiClient<ActivityResponse | ActivityEvent[]>('/api/activity', {
      params: { limit },
    });
    if (Array.isArray(response)) return response;
    return response.events ?? [];
  } catch {
    // Endpoint may not exist yet — return empty so the caller falls back to mock data
    return [];
  }
}
