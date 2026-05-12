import { apiClient } from '../services/apiClient';

export interface BountyComment {
  id: string;
  bounty_id: string;
  parent_id?: string | null;
  author: string;
  message: string;
  created_at: string;
}

interface CommentsResponse {
  items: BountyComment[];
}

export async function listBountyComments(bountyId: string): Promise<CommentsResponse> {
  return apiClient<CommentsResponse>(`/api/bounties/${bountyId}/comments`);
}

export async function createBountyComment(
  bountyId: string,
  payload: { message: string; parent_id?: string }
): Promise<BountyComment> {
  return apiClient<BountyComment>(`/api/bounties/${bountyId}/comments`, {
    method: 'POST',
    body: payload,
  });
}
