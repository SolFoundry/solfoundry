import { apiClient } from '../services/apiClient';
import type { BountyComment } from '../types/comment';

export async function listBountyComments(bountyId: string): Promise<BountyComment[]> {
  const data = await apiClient<{ items: BountyComment[] }>(`/api/bounties/${bountyId}/comments`);
  return data.items;
}

export async function postBountyComment(
  bountyId: string,
  body: string,
  parentId?: string | null,
): Promise<BountyComment> {
  return apiClient<BountyComment>(`/api/bounties/${bountyId}/comments`, {
    method: 'POST',
    body: { body, parent_id: parentId ?? null },
  });
}

export async function deleteBountyComment(bountyId: string, commentId: string): Promise<void> {
  await apiClient(`/api/bounties/${bountyId}/comments/${commentId}`, { method: 'DELETE' });
}

export async function hideBountyComment(bountyId: string, commentId: string): Promise<void> {
  await apiClient(`/api/bounties/${bountyId}/comments/${commentId}/hide`, { method: 'POST' });
}

export function bountyCommentsWebSocketUrl(bountyId: string): string {
  const configured = import.meta.env.VITE_API_URL as string | undefined;
  if (configured && configured.length > 0) {
    const base = configured.replace(/\/$/, '');
    const ws = base.replace(/^http/, 'ws');
    return `${ws}/ws/bounties/${encodeURIComponent(bountyId)}/comments`;
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws/bounties/${encodeURIComponent(bountyId)}/comments`;
}
