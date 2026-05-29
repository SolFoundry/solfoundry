import { describe, expect, it } from 'vitest';
import { normalizeActivityFeed } from '../api/activity';

describe('normalizeActivityFeed', () => {
  it('normalizes nested API payloads and sorts newest first', () => {
    const events = normalizeActivityFeed({
      events: [
        {
          id: 'older',
          event_type: 'bounty_posted',
          actor: 'SolFoundry',
          message: 'Bounty #100 is live',
          created_at: '2026-05-29T11:00:00.000Z',
        },
        {
          id: 'newer',
          type: 'payout_released',
          username: 'builder',
          detail: 'Bounty #99 payout released',
          timestamp: '2026-05-29T12:00:00.000Z',
        },
      ],
    });

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      id: 'newer',
      type: 'payout',
      username: 'builder',
    });
    expect(events[1]).toMatchObject({
      id: 'older',
      type: 'posted',
      username: 'SolFoundry',
    });
  });

  it('handles array payloads with alternate keys', () => {
    const events = normalizeActivityFeed([
      {
        transaction_signature: 'abc123',
        kind: 'pull_request_submitted',
        contributor_username: 'octo',
        description: 'Opened PR #10',
        block_time: '2026-05-29T12:30:00.000Z',
      },
    ]);

    expect(events).toEqual([
      {
        id: 'abc123',
        type: 'submitted',
        username: 'octo',
        avatar_url: null,
        detail: 'Opened PR #10',
        timestamp: '2026-05-29T12:30:00.000Z',
      },
    ]);
  });
});
