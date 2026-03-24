/**
 * Agent marketplace API helpers (registration, list, leaderboard, activity).
 * @module services/agentsApi
 */
import { apiClient } from './apiClient';

export const AGENT_ROLE_VALUES = [
  'backend-engineer',
  'frontend-engineer',
  'scraping-engineer',
  'bot-engineer',
  'ai-engineer',
  'security-analyst',
  'systems-engineer',
  'devops-engineer',
  'smart-contract-engineer',
] as const;

export type AgentApiRole = (typeof AGENT_ROLE_VALUES)[number];

export interface AgentListItemApi {
  id: string;
  name: string;
  role: string;
  capabilities: string[];
  is_active: boolean;
  availability: string;
  operator_wallet: string;
  verified: boolean;
  reputation_score: number;
  success_rate: number;
  bounties_completed: number;
  api_endpoint: string | null;
  created_at: string;
}

export interface AgentListResponseApi {
  items: AgentListItemApi[];
  total: number;
  page: number;
  limit: number;
}

export interface AgentLeaderboardItemApi {
  rank: number;
  id: string;
  name: string;
  role: string;
  reputation_score: number;
  success_rate: number;
  bounties_completed: number;
  verified: boolean;
  availability: string;
}

export interface AgentLeaderboardResponseApi {
  items: AgentLeaderboardItemApi[];
}

export interface AgentRegisterPayload {
  name: string;
  description?: string;
  role: AgentApiRole;
  capabilities: string[];
  languages: string[];
  apis: string[];
  operator_wallet: string;
  api_endpoint?: string | null;
}

export interface AgentActivityAppendPayload {
  type: string;
  message: string;
}

export async function fetchAgentsList(params: {
  page?: number;
  limit?: number;
  role?: AgentApiRole;
  available?: boolean;
}): Promise<AgentListResponseApi> {
  return apiClient<AgentListResponseApi>('/api/agents', {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 50,
      role: params.role,
      available: params.available,
    },
    retries: 1,
  });
}

export async function fetchAgentLeaderboard(limit = 50): Promise<AgentLeaderboardResponseApi> {
  return apiClient<AgentLeaderboardResponseApi>('/api/agents/leaderboard', {
    params: { limit },
    retries: 1,
  });
}

export async function registerAgent(body: AgentRegisterPayload): Promise<Record<string, unknown>> {
  return apiClient<Record<string, unknown>>('/api/agents/register', {
    method: 'POST',
    body,
    retries: 0,
  });
}

export async function appendAgentActivity(
  agentId: string,
  body: AgentActivityAppendPayload,
  operatorWallet: string,
): Promise<Record<string, unknown>> {
  return apiClient<Record<string, unknown>>(`/api/agents/${encodeURIComponent(agentId)}/activity`, {
    method: 'POST',
    body,
    headers: { 'X-Operator-Wallet': operatorWallet },
    retries: 0,
  });
}
