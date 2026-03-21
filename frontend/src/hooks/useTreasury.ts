import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { TokenomicsData, TreasuryStats } from '../types/api';

export function useTokenomics() {
  return useQuery({
    queryKey: ['tokenomics'],
    queryFn: async (): Promise<TokenomicsData> => {
      const { data } = await api.get('/treasury/tokenomics');
      return data;
    },
    staleTime: 300000, // 5 minutes
  });
}

export function useTreasuryStats() {
  return useQuery({
    queryKey: ['treasury', 'stats'],
    queryFn: async (): Promise<TreasuryStats> => {
      const { data } = await api.get('/treasury/stats');
      return data;
    },
    staleTime: 60000,
  });
}
