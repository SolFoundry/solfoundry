import { apiClient } from '../services/apiClient';
import type { BountyComment, BountyCommentCreatePayload } from '../types/comment';

export interface BountyCommentsResponse {
  items: BountyComment[];
}

function normalizeComment(value: BountyComment): BountyComment {
  return {
    ...value,
    moderation_status: value.moderation_status ?? 'visible',
    parent_id: value.parent_id ?? null,
  };
}

export async function listBountyComments(bountyId: string): Promise<BountyComment[]> {
  const response = await apiClient<BountyCommentsResponse | BountyComment[]>(`/api/bounties/${bountyId}/comments`);
  const items = Array.isArray(response) ? response : response.items;
  return (items ?? []).map(normalizeComment).filter((comment) => comment.moderation_status !== 'hidden');
}

export async function createBountyComment(
  bountyId: string,
  payload: BountyCommentCreatePayload,
): Promise<BountyComment> {
  return normalizeComment(
    await apiClient<BountyComment>(`/api/bounties/${bountyId}/comments`, {
      method: 'POST',
      body: payload,
    }),
  );
}
