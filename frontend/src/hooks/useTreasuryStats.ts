import { useQuery } from '@tanstack/react-query';
import type { TokenomicsData, TreasuryStats } from '../types/tokenomics';
import api from '../services/api';

export function useTreasuryStats() {
  const {
    data: tokenomics,
    isLoading: loadingTokenomics,
    error: errorTokenomics,
  } = useQuery({
    queryKey: ['stats', 'tokenomics'],
    queryFn: async (): Promise<TokenomicsData> => {
      const { data } = await api.get('/stats/tokenomics');
      return data;
    },
  });

  const {
    data: treasury,
    isLoading: loadingTreasury,
    error: errorTreasury,
  } = useQuery({
    queryKey: ['stats', 'treasury'],
    queryFn: async (): Promise<TreasuryStats> => {
      const { data } = await api.get('/stats/treasury');
      return data;
    },
  });

  return {
    tokenomics,
    treasury,
    loading: loadingTokenomics || loadingTreasury,
    error: (errorTokenomics || errorTreasury) ? 'Failed to load treasury stats' : null,
  };
}
