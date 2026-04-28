import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listComments,
  createComment,
  updateComment,
  deleteComment,
  moderateComment,
} from '../api/comments';
import type { Comment, CommentCreatePayload, CommentUpdatePayload, ModerationAction } from '../types/comment';

/** Shape stored in the query cache. */
interface CommentsCacheData {
  items: Comment[];
  total: number;
}

/**
 * Convert a flat comment list into a nested tree.
 * Only top-level + visible comments form roots; replies are attached to their parent.
 */
function nestComments(flat: Comment[]): Comment[] {
  const map = new Map<string, Comment>();
  const roots: Comment[] = [];

  // Clone and initialise replies array
  for (const c of flat) {
    map.set(c.id, { ...c, replies: [] });
  }

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

/** Query key factory. */
function commentsKey(bountyId: string) {
  return ['comments', bountyId] as const;
}

/**
 * Fetch & auto-nest comments for a bounty.
 * Refetches every 15 s for near-real-time updates.
 */
export function useComments(bountyId: string | undefined) {
  const enabled = !!bountyId;

  const query = useQuery<CommentsCacheData, Error, CommentsCacheData>({
    queryKey: commentsKey(bountyId!),
    queryFn: () => listComments(bountyId!),
    enabled,
    staleTime: 10_000,
    refetchInterval: 15_000, // near-real-time
    select: (data) => ({
      ...data,
      items: nestComments(data.items.filter((c) => c.status === 'visible')),
    }),
  });

  return query;
}

/**
 * Post a new comment or reply.
 */
export function useCreateComment(bountyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CommentCreatePayload) => createComment(bountyId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: commentsKey(bountyId) });
    },
  });
}

/**
 * Edit an existing comment.
 */
export function useUpdateComment(bountyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, payload }: { commentId: string; payload: CommentUpdatePayload }) =>
      updateComment(bountyId, commentId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: commentsKey(bountyId) });
    },
  });
}

/**
 * Delete a comment.
 */
export function useDeleteComment(bountyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => deleteComment(bountyId, commentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: commentsKey(bountyId) });
    },
  });
}

/**
 * Moderate a comment (approve / hide / flag as spam).
 */
export function useModerateComment(bountyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, action }: { commentId: string; action: ModerationAction }) =>
      moderateComment(bountyId, commentId, action),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: commentsKey(bountyId) });
    },
  });
}
