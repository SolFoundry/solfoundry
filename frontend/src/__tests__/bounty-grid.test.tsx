import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { BountyGrid } from '../components/bounty/BountyGrid';
import { useInfiniteBounties } from '../hooks/useBounties';

// Mock IntersectionObserver for Framer Motion viewport triggers in JSDOM
class MockIntersectionObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
});

// Mock the useInfiniteBounties hook
vi.mock('../hooks/useBounties', () => ({
  useInfiniteBounties: vi.fn(),
}));

const mockBounties = [
  {
    id: 'b1',
    title: 'Fix OAuth Redirect Loop',
    description: 'Centralize GitHub sign-in redirects and prevent loop',
    status: 'open',
    tier: 'T1',
    reward_amount: 150000,
    reward_token: 'FNDRY',
    skills: ['FastAPI', 'TypeScript'],
    submission_count: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: 'b2',
    title: 'Add Search Bar Component',
    description: 'Interactive filtering for grid listings',
    status: 'open',
    tier: 'T1',
    reward_amount: 100000,
    reward_token: 'FNDRY',
    skills: ['React', 'Tailwind'],
    submission_count: 1,
    created_at: new Date().toISOString(),
  },
];

describe('BountyGrid Search Integration', () => {
  beforeEach(() => {
    vi.mocked(useInfiniteBounties).mockReturnValue({
      data: {
        pages: [{ items: mockBounties, total: 2 }],
        pageParams: [0],
      },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);
  });

  it('renders all bounties initially', () => {
    render(
      <MemoryRouter>
        <BountyGrid />
      </MemoryRouter>
    );

    expect(screen.getByText('Fix OAuth Redirect Loop')).toBeInTheDocument();
    expect(screen.getByText('Add Search Bar Component')).toBeInTheDocument();
  });

  it('filters bounties by title after debounce delay', async () => {
    render(
      <MemoryRouter>
        <BountyGrid />
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/search bounties/i);
    await userEvent.type(input, 'OAuth');

    // Wait for the debounce delay (300ms) to trigger filtering
    await waitFor(() => {
      expect(screen.getByText('Fix OAuth Redirect Loop')).toBeInTheDocument();
      expect(screen.queryByText('Add Search Bar Component')).not.toBeInTheDocument();
    });
  });

  it('filters bounties by description case-insensitively', async () => {
    render(
      <MemoryRouter>
        <BountyGrid />
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/search bounties/i);
    await userEvent.type(input, 'INTERACTIVE');

    await waitFor(() => {
      expect(screen.getByText('Add Search Bar Component')).toBeInTheDocument();
      expect(screen.queryByText('Fix OAuth Redirect Loop')).not.toBeInTheDocument();
    });
  });

  it('filters bounties by tags (skills)', async () => {
    render(
      <MemoryRouter>
        <BountyGrid />
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/search bounties/i);
    await userEvent.type(input, 'Tailwind');

    await waitFor(() => {
      expect(screen.getByText('Add Search Bar Component')).toBeInTheDocument();
      expect(screen.queryByText('Fix OAuth Redirect Loop')).not.toBeInTheDocument();
    });
  });

  it('displays empty state and resets search correctly', async () => {
    render(
      <MemoryRouter>
        <BountyGrid />
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/search bounties/i);
    await userEvent.type(input, 'nonexistent');

    await waitFor(() => {
      expect(screen.getByText('No matching bounties')).toBeInTheDocument();
      expect(screen.queryByText('Fix OAuth Redirect Loop')).not.toBeInTheDocument();
    });

    const resetBtn = screen.getByRole('button', { name: /reset search/i });
    await userEvent.click(resetBtn);

    await waitFor(() => {
      expect(screen.getByText('Fix OAuth Redirect Loop')).toBeInTheDocument();
      expect(screen.getByText('Add Search Bar Component')).toBeInTheDocument();
      expect(input).toHaveValue('');
    });
  });

  it('clears search query when clicking the X button', async () => {
    render(
      <MemoryRouter>
        <BountyGrid />
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/search bounties/i);
    await userEvent.type(input, 'OAuth');

    await waitFor(() => {
      expect(screen.getByText('Fix OAuth Redirect Loop')).toBeInTheDocument();
      expect(screen.queryByText('Add Search Bar Component')).not.toBeInTheDocument();
    });

    const clearBtn = screen.getByRole('button', { name: /clear search/i });
    await userEvent.click(clearBtn);

    await waitFor(() => {
      expect(screen.getByText('Fix OAuth Redirect Loop')).toBeInTheDocument();
      expect(screen.getByText('Add Search Bar Component')).toBeInTheDocument();
      expect(input).toHaveValue('');
    });
  });
});
