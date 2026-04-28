import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from '@tanstack/react-query';
import {
  listComments,
  createComment,
  updateComment,
  deleteComment,
  toggleUpvote,
  reportComment,
} from '../api/comments';
import type { Comment, CommentCreatePayload, CommentUpdatePayload } from '../types/comment';

/** Query key factory for comments. */
export const commentKeys = {
  all: (bountyId: string) => ['comments', bountyId] as const,
  list: (bountyId: string, params?: { limit?: number; offset?: number }) =>
    ['comments', bountyId, 'list', params] as const,
};

/** Rebuild a flat list of comments into a nested tree. */
export function buildCommentTree(flat: Comment[]): Comment[] {
  const map = new Map<string, Comment>();
  const roots: Comment[] = [];

  // First pass: create map entries
  for (const c of flat) {
    map.set(c.id, { ...c, replies: [] });
  }

  // Second pass: build tree
  for (const c of flat) {
    const node = map.get(c.id)!;
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id)!.replies!.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/** Fetch all comments for a bounty and build the nested tree. */
export function useComments(bountyId: string) {
  return useQuery({
    queryKey: commentKeys.all(bountyId),
    queryFn: async () => {
      const response = await listComments(bountyId, { limit: 500 });
      return buildCommentTree(response.items);
    },
    staleTime: 15_000,
    refetchInterval: 30_000, // Real-time updates: refetch every 30s
    enabled: !!bountyId,
  });
}

/** Infinite-scroll variant (if needed later). */
export function useInfiniteComments(bountyId: string) {
  return useInfiniteQuery({
    queryKey: commentKeys.list(bountyId),
    queryFn: ({ pageParam = 0 }) =>
      listComments(bountyId, { limit: 20, offset: pageParam as number }),
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((sum, p) => sum + p.items.length, 0);
      if (loaded >= lastPage.total) return undefined;
      return loaded;
    },
    initialPageParam: 0,
    staleTime: 15_000,
    enabled: !!bountyId,
  });
}

/** Post a new comment or reply. */
export function useCreateComment(bountyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CommentCreatePayload) => createComment(bountyId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentKeys.all(bountyId) });
    },
  });
}

/** Edit an existing comment. */
export function useUpdateComment(bountyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId, payload }: { commentId: string; payload: CommentUpdatePayload }) =>
      updateComment(bountyId, commentId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentKeys.all(bountyId) });
    },
  });
}

/** Delete a comment. */
export function useDeleteComment(bountyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) => deleteComment(bountyId, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentKeys.all(bountyId) });
    },
  });
}

/** Toggle upvote on a comment. */
export function useToggleUpvote(bountyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) => toggleUpvote(bountyId, commentId),
    // Optimistic update
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey: commentKeys.all(bountyId) });
      const previous = queryClient.getQueryData<Comment[]>(commentKeys.all(bountyId));

      // Optimistically toggle upvote in the cached tree
      const toggleInTree = (comments: Comment[]): Comment[] =>
        comments.map((c) => {
          if (c.id === commentId) {
            const hadUpvoted = c.has_upvoted ?? false;
            return {
              ...c,
              has_upvoted: !hadUpvoted,
              upvote_count: hadUpvoted ? c.upvote_count - 1 : c.upvote_count + 1,
            };
          }
          if (c.replies?.length) {
            return { ...c, replies: toggleInTree(c.replies) };
          }
          return c;
        });

      if (previous) {
        queryClient.setQueryData(commentKeys.all(bountyId), toggleInTree(previous));
      }

      return { previous };
    },
    onError: (_err, _commentId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(commentKeys.all(bountyId), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: commentKeys.all(bountyId) });
    },
  });
}

/** Report a comment for moderation. */
export function useReportComment(bountyId: string) {
  return useMutation({
    mutationFn: ({ commentId, reason }: { commentId: string; reason: string }) =>
      reportComment(bountyId, commentId, reason),
  });
}
