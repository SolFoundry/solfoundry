import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listComments, createComment, deleteComment } from '../api/comments';
import type { CommentCreatePayload } from '../types/comment';

export function useComments(bountyId: string | undefined) {
  return useQuery({
    queryKey: ['comments', bountyId],
    queryFn: () => listComments(bountyId!),
    enabled: !!bountyId,
    staleTime: 10_000,
  });
}

export function useReplies(bountyId: string | undefined, parentId: string | null) {
  return useQuery({
    queryKey: ['comments', bountyId, 'replies', parentId],
    queryFn: () => listComments(bountyId!, { parent_id: parentId ?? undefined, limit: 50 }),
    enabled: !!bountyId && !!parentId,
    staleTime: 10_000,
  });
}

export function useCreateComment(bountyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CommentCreatePayload) => createComment(bountyId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', bountyId] });
    },
  });
}

export function useDeleteComment(bountyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) => deleteComment(bountyId, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', bountyId] });
    },
  });
}