import { afterEach, describe, expect, it, vi } from 'vitest';
import { listActivity, normalizeActivityEvent } from '../api/activity';

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('activity API', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches /api/activity and normalizes event payloads', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        items: [
          {
            id: 'evt-payout',
            event_type: 'payout_released',
            actor: { login: 'treasury', avatar_url: 'https://example.com/avatar.png' },
            message: '200,000 FNDRY paid for Bounty #822',
            created_at: '2026-05-12T12:00:00.000Z',
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const events = await listActivity({ limit: 2 });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/activity?limit=2',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(events).toEqual([
      {
        id: 'evt-payout',
        type: 'payout',
        username: 'treasury',
        avatar_url: 'https://example.com/avatar.png',
        detail: '200,000 FNDRY paid for Bounty #822',
        timestamp: '2026-05-12T12:00:00.000Z',
      },
    ]);
  });

  it('drops malformed events that lack a timestamp or detail', () => {
    expect(normalizeActivityEvent({ id: 'bad' }, 0)).toBeNull();
  });
});
