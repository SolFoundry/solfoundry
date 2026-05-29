import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { ActivityFeed } from '../components/home/ActivityFeed';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function okJson(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(data),
    headers: new Headers({ 'content-type': 'application/json' }),
    redirected: false,
    type: 'basic' as ResponseType,
    url: '',
    clone() { return this; },
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as Response;
}

function failJson(status: number): Response {
  return {
    ok: false,
    status,
    statusText: 'Error',
    json: () => Promise.resolve({ message: 'error' }),
    headers: new Headers({ 'content-type': 'application/json' }),
    redirected: false,
    type: 'basic' as ResponseType,
    url: '',
    clone() { return this; },
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve('{"message":"error"}'),
  } as Response;
}

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('ActivityFeed', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('renders API-backed events', async () => {
    mockFetch.mockResolvedValue(
      okJson({
        events: [
          {
            id: 'evt-1',
            type: 'payout_released',
            username: 'octocat',
            detail: 'Bounty #42',
            timestamp: '2026-05-29T12:00:00.000Z',
          },
        ],
      }),
    );

    renderWithQuery(<ActivityFeed />);

    await waitFor(() => {
      expect(screen.getByText('octocat')).toBeInTheDocument();
    });
    expect(screen.getByText(/received payout for/i)).toBeInTheDocument();
    expect(screen.getByText('Bounty #42')).toBeInTheDocument();
  });

  it('shows empty state when API returns no events', async () => {
    mockFetch.mockResolvedValue(okJson({ events: [] }));

    renderWithQuery(<ActivityFeed />);

    await waitFor(() => {
      expect(screen.getByTestId('activity-feed-empty')).toBeInTheDocument();
    });
    expect(screen.getByText('No recent activity')).toBeInTheDocument();
  });

  it('shows graceful fallback when API is unavailable', async () => {
    mockFetch.mockResolvedValue(failJson(503));

    renderWithQuery(<ActivityFeed />);

    await waitFor(() => {
      expect(screen.getByTestId('activity-feed-error')).toBeInTheDocument();
    });
    expect(screen.getByText('Activity feed unavailable right now.')).toBeInTheDocument();
  });
});
