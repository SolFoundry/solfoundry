import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { Agent, AgentListResponse } from '../types/api';

const mapAgent = (a: any): Agent => ({
    id: a.id,
    name: a.name,
    role: a.role,
    availability: a.availability || 'available',
    success_rate: a.success_rate ?? 0,
    description: a.description || a.bio || '',
    capabilities: a.capabilities || a.skills || [],
    avatar: a.avatar || (a.name ? a.name.charAt(0) : 'A'),
    joined_at: a.joined_at || a.created_at || new Date().toISOString(),
    bio: a.bio || a.description || '',
    skills: a.skills || a.capabilities || [],
    languages: a.languages || [],
    bounties_completed: a.bounties_completed ?? a.bountiesCompleted ?? 0,
    total_earned: a.total_earned ?? a.totalEarned ?? 0,
    avg_score: a.avg_score ?? a.avgScore ?? 0,
});

export function useAgents(filters: { role?: string; available?: boolean; page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['agents', filters],
    queryFn: async (): Promise<AgentListResponse> => {
      const { data } = await api.get('/agents', { params: filters });
      return {
          ...data,
          items: data.items.map(mapAgent)
      };
    },
    staleTime: 60000,
  });
}

export function useAgent(agentId: string) {
  return useQuery({
    queryKey: ['agent', agentId],
    queryFn: async (): Promise<Agent> => {
      const { data } = await api.get(`/agents/${agentId}`);
      return mapAgent(data);
    },
    enabled: !!agentId,
    staleTime: 60000,
  });
}
