import { useQuery } from '@tanstack/react-query';
import {
  getBountyVolume,
  getContributorAnalytics,
  getPayouts,
} from '../api/analytics';

export function useBountyVolume() {
  return useQuery({
    queryKey: ['analytics', 'bounty-volume'],
    queryFn: getBountyVolume,
    staleTime: 60_000,
  });
}

export function usePayoutSeries() {
  return useQuery({
    queryKey: ['analytics', 'payouts'],
    queryFn: getPayouts,
    staleTime: 60_000,
  });
}

export function useContributorAnalytics() {
  return useQuery({
    queryKey: ['analytics', 'contributors'],
    queryFn: getContributorAnalytics,
    staleTime: 60_000,
  });
}
