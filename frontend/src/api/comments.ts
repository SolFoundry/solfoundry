import { apiClient } from '../services/apiClient';
import type {
  Comment,
  CommentCreatePayload,
  CommentUpdatePayload,
  CommentsListResponse,
  ModerationAction,
} from '../types/comment';

/**
 * List all comments for a bounty (flat list — nesting built client-side).
 */
export async function listComments(bountyId: string): Promise<CommentsListResponse> {
  return apiClient<CommentsListResponse>(`/api/bounties/${bountyId}/comments`);
}

/**
 * Create a new comment (top-level or reply).
 */
export async function createComment(
  bountyId: string,
  payload: CommentCreatePayload,
): Promise<Comment> {
  return apiClient<Comment>(`/api/bounties/${bountyId}/comments`, {
    method: 'POST',
    body: payload,
  });
}

/**
 * Update an existing comment.
 */
export async function updateComment(
  bountyId: string,
  commentId: string,
  payload: CommentUpdatePayload,
): Promise<Comment> {
  return apiClient<Comment>(`/api/bounties/${bountyId}/comments/${commentId}`, {
    method: 'PATCH',
    body: payload,
  });
}

/**
 * Delete a comment.
 */
export async function deleteComment(
  bountyId: string,
  commentId: string,
): Promise<void> {
  return apiClient<void>(`/api/bounties/${bountyId}/comments/${commentId}`, {
    method: 'DELETE',
  });
}

/**
 * Moderate a comment (admin/reviewer).
 */
export async function moderateComment(
  bountyId: string,
  commentId: string,
  action: ModerationAction,
): Promise<Comment> {
  return apiClient<Comment>(`/api/bounties/${bountyId}/comments/${commentId}/moderate`, {
    method: 'POST',
    body: action,
  });
}
