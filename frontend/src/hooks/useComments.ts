import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createBountyComment, listBountyComments } from '../api/comments';

export function useBountyComments(bountyId: string | undefined) {
  return useQuery({
    queryKey: ['bounty-comments', bountyId],
    queryFn: () => listBountyComments(bountyId!),
    enabled: !!bountyId,
    refetchInterval: 5000,
    staleTime: 3000,
  });
}

export function useCreateBountyComment(bountyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { message: string; parent_id?: string }) =>
      createBountyComment(bountyId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bounty-comments', bountyId] });
    },
  });
}
