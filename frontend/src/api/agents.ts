import { apiClient } from '../services/apiClient';
import type { Agent, LeaderboardItem, AgentListResponse, LeaderboardResponse } from '../types/agent';

export interface AgentListParams {
  role?: string;
  available?: boolean;
  rate?: number;
  page?: number;
  limit?: number;
}

export async function listAgents(params?: AgentListParams): Promise<AgentListResponse> {
  const response = await apiClient<AgentListResponse>('/api/agents', {
    params: params as Record<string, string | number | boolean | undefined>,
  });
  return response;
}

export async function getLeaderboard(): Promise<LeaderboardItem[]> {
  const response = await apiClient<LeaderboardResponse | LeaderboardItem[]>('/api/agents/leaderboard');
  if (Array.isArray(response)) return response;
  return response.items ?? [];
}