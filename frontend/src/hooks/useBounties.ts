import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

export interface Bounty {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'claimed' | 'completed' | 'cancelled';
  reward_amount: number;
  reward_token: string;
  tier: number;
  creator_id: string;
  created_at: string;
  deadline?: string;
  tags?: string[];
  github_issue_url?: string;
}

export const fetchBounties = async (): Promise<Bounty[]> => {
  const { data } = await api.get<Bounty[]>('/bounties');
  return data;
};

export const useBounties = () => {
  return useQuery({
    queryKey: ['bounties'],
    queryFn: fetchBounties,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useBounty = (id: string) => {
  return useQuery({
    queryKey: ['bounty', id],
    queryFn: async (): Promise<Bounty> => {
      const { data } = await api.get<Bounty>(`/bounties/${id}`);
      return data;
    },
    enabled: !!id,
  });
};
