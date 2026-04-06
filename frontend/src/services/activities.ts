import { apiClient } from '../services/apiClient';

export interface ActivityEvent {
  id: string;
  type: 'completed' | 'submitted' | 'posted' | 'review';
  username: string;
  avatar_url?: string | null;
  detail: string;
  timestamp: string;
  bounty_id?: string;
  bounty_title?: string;
  amount?: string;
  token?: string;
}

export interface ActivitiesResponse {
  activities: ActivityEvent[];
}

const POLL_INTERVAL_MS = 30_000;

let pollTimer: ReturnType<typeof setInterval> | null = null;
const listeners: Set<(activities: ActivityEvent[]) => void> = new Set();

/**
 * Fetch activities from the backend API.
 * Returns empty array on error (graceful fallback).
 */
export async function fetchActivities(): Promise<ActivityEvent[]> {
  try {
    const data = await apiClient<ActivitiesResponse | { activities: ActivityEvent[] }>(
      '/api/activities',
      { params: { limit: 10 } }
    );
    // Handle both response shapes
    if ('activities' in data) {
      return data.activities;
    }
    return [];
  } catch (error) {
    console.warn('[activities] API fetch failed, using fallback:', error);
    return [];
  }
}

/**
 * Start polling the activities endpoint every 30 seconds.
 * Notifies all registered listeners with the latest activities.
 */
export function startActivitiesPolling(): void {
  if (pollTimer !== null) return;

  async function poll(): Promise<void> {
    const activities = await fetchActivities();
    listeners.forEach(cb => {
      try {
        cb(activities);
      } catch (e) {
        console.error('[activities] listener error:', e);
      }
    });
  }

  // Poll immediately, then every 30s
  poll();
  pollTimer = setInterval(poll, POLL_INTERVAL_MS);
}

/**
 * Stop polling for new activities.
 */
export function stopActivitiesPolling(): void {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

/**
 * Subscribe to activity updates.
 * Returns an unsubscribe function.
 */
export function onActivities(callback: (activities: ActivityEvent[]) => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}
