import { apiClient } from '../services/apiClient';
import type { Comment, CommentCreatePayload, CommentUpdatePayload, CommentListResponse } from '../types/comment';

export async function listComments(
  bountyId: string,
  params?: { parent_id?: string; skip?: number; limit?: number }
): Promise<CommentListResponse> {
  return apiClient<CommentListResponse>(`/api/bounties/${bountyId}/comments`, {
    params: params as Record<string, string | number | boolean | undefined>,
  });
}

export async function getComment(bountyId: string, commentId: string): Promise<Comment> {
  return apiClient<Comment>(`/api/bounties/${bountyId}/comments/${commentId}`);
}

export async function createComment(
  bountyId: string,
  payload: CommentCreatePayload
): Promise<Comment> {
  return apiClient<Comment>(`/api/bounties/${bountyId}/comments`, {
    method: 'POST',
    body: payload,
  });
}

export async function updateComment(
  bountyId: string,
  commentId: string,
  payload: CommentUpdatePayload
): Promise<Comment> {
  return apiClient<Comment>(`/api/bounties/${bountyId}/comments/${commentId}`, {
    method: 'PATCH',
    body: payload,
  });
}

export async function deleteComment(
  bountyId: string,
  commentId: string
): Promise<void> {
  return apiClient<void>(`/api/bounties/${bountyId}/comments/${commentId}`, {
    method: 'DELETE',
  });
}