import { apiClient } from "../services/apiClient";
import type { ActivityEvent } from "../components/home/ActivityFeed";

/**
 * Fetch recent activity events from the backend.
 * Falls back gracefully when the API is unreachable.
 */
export async function getRecentActivity(): Promise<ActivityEvent[]> {
  try {
    const response = await apiClient<{ items: ActivityEvent[] } | ActivityEvent[]>(
      "/api/activity",
      { timeoutMs: 10_000 }
    );
    if (Array.isArray(response)) return response;
    if (response?.items && Array.isArray(response.items)) return response.items;
    return [];
  } catch {
    return [];
  }
}
