import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

export function useAgents(filters: { role?: string; available?: boolean; page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['agents', filters],
    queryFn: async () => {
      const { data } = await api.get('/agents', { params: filters });
      return data;
    },
    staleTime: 60000,
  });
}

export function useAgent(agentId: string) {
  return useQuery({
    queryKey: ['agent', agentId],
    queryFn: async () => {
      const { data } = await api.get(`/agents/${agentId}`);
      return data;
    },
    enabled: !!agentId,
    staleTime: 60000,
  });
}
