import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { ActivityFeed } from '../components/home/ActivityFeed';
import { listActivity } from '../api/activity';
import type { ActivityEvent } from '../api/activity';

vi.mock('../api/activity', () => ({
  listActivity: vi.fn(),
}));

const mockListActivity = vi.mocked(listActivity);

const SUBMISSION_EVENT: ActivityEvent = {
  id: 'evt-submitted',
  type: 'submitted',
  username: 'devbuilder',
  avatar_url: null,
  detail: 'PR #77 to Bounty #822',
  timestamp: '2026-05-12T12:00:00.000Z',
};

const PAYOUT_EVENT: ActivityEvent = {
  id: 'evt-payout',
  type: 'payout',
  username: 'treasury',
  avatar_url: null,
  detail: '200,000 FNDRY for Bounty #99',
  timestamp: '2026-05-12T12:01:00.000Z',
};

function renderWithQueryClient(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      {ui}
    </QueryClientProvider>,
  );
}

describe('ActivityFeed', () => {
  beforeEach(() => {
    mockListActivity.mockReset();
  });

  it('renders real activity from the API', async () => {
    mockListActivity.mockResolvedValue([SUBMISSION_EVENT]);

    renderWithQueryClient(<ActivityFeed />);

    await waitFor(() => expect(mockListActivity).toHaveBeenCalledWith({ limit: 4 }));
    expect(await screen.findByText('devbuilder')).toBeInTheDocument();
    expect(screen.getByText('PR #77 to Bounty #822')).toBeInTheDocument();
    expect(screen.queryByText('Activity feed unavailable')).not.toBeInTheDocument();
  });

  it('shows an empty state when the API has no events', async () => {
    mockListActivity.mockResolvedValue([]);

    renderWithQueryClient(<ActivityFeed />);

    expect(await screen.findByText('No recent activity')).toBeInTheDocument();
    expect(screen.queryByText('devbuilder')).not.toBeInTheDocument();
  });

  it('falls back gracefully when the activity API is unavailable', async () => {
    mockListActivity.mockRejectedValue(new Error('offline'));

    renderWithQueryClient(<ActivityFeed />);

    expect(await screen.findByText('Activity feed unavailable')).toBeInTheDocument();
  });

  it('refreshes activity without a page reload', async () => {
    mockListActivity
      .mockResolvedValueOnce([SUBMISSION_EVENT])
      .mockResolvedValue([PAYOUT_EVENT]);

    renderWithQueryClient(<ActivityFeed refreshIntervalMs={20} />);

    expect(await screen.findByText('PR #77 to Bounty #822')).toBeInTheDocument();
    await waitFor(() => expect(mockListActivity).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('200,000 FNDRY for Bounty #99')).toBeInTheDocument();
  });
});
