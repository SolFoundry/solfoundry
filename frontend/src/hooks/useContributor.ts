import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { Contributor } from '../types/api';

export const fetchContributor = async (idOrUsername: string): Promise<Contributor> => {
  const { data } = await api.get<Contributor>(`/contributors/${idOrUsername}`);
  return data;
};

export const useContributor = (idOrUsername: string) => {
  return useQuery({
    queryKey: ['contributor', idOrUsername],
    queryFn: () => fetchContributor(idOrUsername),
    enabled: !!idOrUsername,
  });
};

export function useContributorDashboard() {
  return useQuery({
    queryKey: ['contributor-dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/contributors/me/dashboard');
      return data;
    },
    staleTime: 30000,
  });
}

export function useCreatorDashboard(walletAddress: string) {
  return useQuery({
    queryKey: ['creator-dashboard', walletAddress],
    queryFn: async () => {
      const [bountiesRes, statsRes] = await Promise.all([
        api.get(`/bounties?created_by=${walletAddress}&limit=100`),
        api.get(`/bounties/creator/${walletAddress}/stats`)
      ]);
      return {
        bounties: bountiesRes.data.items || [],
        stats: statsRes.data
      };
    },
    enabled: !!walletAddress,
    staleTime: 30000,
  });
}
