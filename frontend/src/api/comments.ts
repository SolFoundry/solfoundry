import { apiClient } from '../services/apiClient';
import type {
  Comment,
  CommentCreatePayload,
  CommentUpdatePayload,
  CommentsListResponse,
} from '../types/comment';

const BASE = '/api/bounties';

/** List comments for a bounty (flat list, includes parent_id for nesting). */
export async function listComments(
  bountyId: string,
  params?: { limit?: number; offset?: number }
): Promise<CommentsListResponse> {
  return apiClient<CommentsListResponse>(`${BASE}/${bountyId}/comments`, { params });
}

/** Create a new comment or reply. */
export async function createComment(
  bountyId: string,
  payload: CommentCreatePayload
): Promise<Comment> {
  return apiClient<Comment>(`${BASE}/${bountyId}/comments`, {
    method: 'POST',
    body: payload,
  });
}

/** Update an existing comment. */
export async function updateComment(
  bountyId: string,
  commentId: string,
  payload: CommentUpdatePayload
): Promise<Comment> {
  return apiClient<Comment>(`${BASE}/${bountyId}/comments/${commentId}`, {
    method: 'PATCH',
    body: payload,
  });
}

/** Delete a comment. */
export async function deleteComment(
  bountyId: string,
  commentId: string
): Promise<void> {
  return apiClient<void>(`${BASE}/${bountyId}/comments/${commentId}`, {
    method: 'DELETE',
  });
}

/** Upvote / toggle upvote on a comment. */
export async function toggleUpvote(
  bountyId: string,
  commentId: string
): Promise<{ upvote_count: number; has_upvoted: boolean }> {
  return apiClient<{ upvote_count: number; has_upvoted: boolean }>(
    `${BASE}/${bountyId}/comments/${commentId}/upvote`,
    { method: 'POST' }
  );
}

/** Report a comment for spam / moderation. */
export async function reportComment(
  bountyId: string,
  commentId: string,
  reason: string
): Promise<void> {
  return apiClient<void>(`${BASE}/${bountyId}/comments/${commentId}/report`, {
    method: 'POST',
    body: { reason },
  });
}
