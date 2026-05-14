
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACTIVITY_FEED_ENDPOINT, getActivityEvents } from '../api/activity';
import { ActivityFeed } from '../components/home/ActivityFeed';

const mockFetch = vi.fn();

function jsonResponse(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    statusText: init.statusText ?? 'OK',
    headers: {
      'content-type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>,
  );
}

describe('activity feed API integration', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches and normalizes activity events from the documented analytics endpoint', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({
      events: [
        {
          id: 'evt-1',
          type: 'reward_paid',
          actor: { login: 'alice', avatar_url: 'https://example.com/avatar.png' },
          amount: 500,
          reward_token: 'USDC',
          created_at: '2026-05-11T10:00:00.000Z',
        },
      ],
    }));

    const events = await getActivityEvents({ limit: 4 });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(`${ACTIVITY_FEED_ENDPOINT}?limit=4`),
      expect.objectContaining({ method: 'GET' }),
    );
    expect(events).toEqual([
      {
        id: 'evt-1',
        type: 'payout',
        username: 'alice',
        avatar_url: 'https://example.com/avatar.png',
        detail: '500 USDC',
        timestamp: '2026-05-11T10:00:00.000Z',
      },
    ]);
  });

  it('renders real API activity in the home feed', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([
      {
        id: 'evt-2',
        type: 'pr_submitted',
        username: 'builder',
        detail: 'PR to Bounty #822',
        timestamp: new Date().toISOString(),
      },
    ]));

    renderWithClient(<ActivityFeed />);

    expect(await screen.findByText('builder')).toBeInTheDocument();
    expect(screen.getByText(/submitted/i)).toBeInTheDocument();
    expect(screen.getByText('PR to Bounty #822')).toBeInTheDocument();
  });

  it('shows an empty state when the API has no recent activity', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ events: [] }));

    renderWithClient(<ActivityFeed />);

    expect(await screen.findByText(/no recent activity/i)).toBeInTheDocument();
  });
});
