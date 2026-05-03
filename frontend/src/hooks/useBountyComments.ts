import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createBountyComment, listBountyComments } from '../api/comments';
import type { BountyCommentCreatePayload } from '../types/comment';

export function useBountyComments(bountyId: string) {
  return useQuery({
    queryKey: ['bounty-comments', bountyId],
    queryFn: () => listBountyComments(bountyId),
    enabled: Boolean(bountyId),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

export function useCreateBountyComment(bountyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: BountyCommentCreatePayload) => createBountyComment(bountyId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bounty-comments', bountyId] }),
  });
}
