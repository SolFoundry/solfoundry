import { apiClient } from '../services/apiClient';
import type { LeaderboardEntry, TimePeriod } from '../types/leaderboard';

export async function getLeaderboard(period?: TimePeriod): Promise<LeaderboardEntry[]> {
  const params: Record<string, string> = {};
  if (period && period !== 'all') params.period = period;
  const response = await apiClient<LeaderboardEntry[] | { items: LeaderboardEntry[] }>('/api/leaderboard', { params });
  if (Array.isArray(response)) return response;
  return response.items ?? [];
}
