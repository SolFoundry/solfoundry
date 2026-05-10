import React from 'react';
import { act } from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActivityFeed } from './ActivityFeed';

describe('ActivityFeed', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('fetches recent activity from the API and refreshes every 30 seconds', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          {
            id: 'evt-1',
            type: 'completed',
            username: 'alice',
            detail: '100,000 FNDRY from Bounty #822',
            timestamp: new Date().toISOString(),
          },
        ]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          {
            id: 'evt-2',
            type: 'submitted',
            username: 'bob',
            detail: 'PR to Bounty #826',
            timestamp: new Date().toISOString(),
          },
        ]),
      });

    vi.stubGlobal('fetch', fetchMock);

    render(<ActivityFeed />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('100,000 FNDRY from Bounty #822')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText('bob')).toBeInTheDocument();
    expect(screen.getByText('PR to Bounty #826')).toBeInTheDocument();
  });

  it('shows an empty state when the API returns no activity', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    }));

    render(<ActivityFeed />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('No recent activity')).toBeInTheDocument();
  });
});
