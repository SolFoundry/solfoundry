import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createBountyComment, listBountyComments, normalizeComment } from '../api/comments';
import { apiClient } from '../services/apiClient';
import type { BountyComment } from '../types/comment';

vi.mock('../services/apiClient', () => ({
  apiClient: vi.fn(),
}));

const mockApiClient = vi.mocked(apiClient);

const baseComment: BountyComment = {
  id: 'c1',
  bounty_id: 'b1',
  author_username: 'alice',
  body: 'Looks good',
  created_at: '2026-05-03T00:00:00Z',
};

beforeEach(() => {
  mockApiClient.mockReset();
});

describe('bounty comments api', () => {
  it('normalizes optional moderation and parent fields', () => {
    expect(normalizeComment(baseComment)).toMatchObject({
      moderation_status: 'visible',
      parent_id: null,
    });
  });

  it('supports paginated responses and filters hidden comments', async () => {
    mockApiClient.mockResolvedValueOnce({
      items: [
        baseComment,
        { ...baseComment, id: 'c2', moderation_status: 'hidden' },
        { ...baseComment, id: 'c3', parent_id: 'c1', moderation_status: 'pending' },
      ],
    });

    const comments = await listBountyComments('b1');

    expect(mockApiClient).toHaveBeenCalledWith('/api/bounties/b1/comments');
    expect(comments.map((comment) => comment.id)).toEqual(['c1', 'c3']);
    expect(comments[1].moderation_status).toBe('pending');
  });

  it('posts new comments to the bounty comments endpoint', async () => {
    mockApiClient.mockResolvedValueOnce({ ...baseComment, id: 'new-comment' });

    const comment = await createBountyComment('b1', { body: 'I can help', parent_id: null });

    expect(mockApiClient).toHaveBeenCalledWith('/api/bounties/b1/comments', {
      method: 'POST',
      body: { body: 'I can help', parent_id: null },
    });
    expect(comment.id).toBe('new-comment');
  });
});
