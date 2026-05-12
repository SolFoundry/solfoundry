import { useQuery } from '@tanstack/react-query';
import { listBountyReviews } from '../api/reviews';

export function useBountyReviews(bountyId: string | undefined) {
  return useQuery({
    queryKey: ['bounty-reviews', bountyId],
    queryFn: () => listBountyReviews(bountyId!),
    enabled: !!bountyId,
    staleTime: 20_000,
    refetchInterval: 30_000,
  });
}
