import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { BountyGrid } from '../components/bounty/BountyGrid';
import { BountyCountdown } from '../components/bounty/BountyCountdown';
import type { Bounty } from '../types/bounty';

const bounties: Bounty[] = [
  {
    id: 'search-1',
    title: 'Build TypeScript bounty search',
    description: 'Add fast filtering to marketplace cards',
    status: 'open',
    tier: 'T1',
    reward_amount: 100000,
    reward_token: 'FNDRY',
    skills: ['TypeScript', 'React'],
    deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    submission_count: 1,
    created_at: new Date().toISOString(),
    org_name: 'SolFoundry',
    repo_name: 'solfoundry',
  },
  {
    id: 'search-2',
    title: 'Rust review bot',
    description: 'Audit pull requests automatically',
    status: 'open',
    tier: 'T1',
    reward_amount: 100000,
    reward_token: 'FNDRY',
    skills: ['Rust'],
    deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    submission_count: 0,
    created_at: new Date().toISOString(),
    org_name: 'SolFoundry',
    repo_name: 'solfoundry',
  },
];

vi.mock('../hooks/useBounties', () => ({
  useInfiniteBounties: () => ({
    data: { pages: [{ items: bounties, total: bounties.length, limit: 12, offset: 0 }] },
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    isError: false,
  }),
}));

describe('BountyGrid search', () => {
  beforeEach(() => {
    class MockIntersectionObserver {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('filters bounties by title, description, and tags with a clear button', async () => {
    const user = userEvent.setup();
    render(<BountyGrid />, { wrapper: MemoryRouter });

    expect(screen.getByText('Build TypeScript bounty search')).toBeInTheDocument();
    expect(screen.getByText('Rust review bot')).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: /search bounties/i }), 'react');

    await waitFor(() => {
      expect(screen.getByText('Build TypeScript bounty search')).toBeInTheDocument();
      expect(screen.queryByText('Rust review bot')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /clear bounty search/i }));

    await waitFor(() => {
      expect(screen.getByText('Rust review bot')).toBeInTheDocument();
    });
  });
});

describe('BountyCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-07T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows warning, urgent, and expired states from the deadline', () => {
    const { rerender } = render(<BountyCountdown deadline="2026-06-07T14:30:00Z" />);
    expect(screen.getByTestId('bounty-countdown')).toHaveTextContent('2h 30m');

    rerender(<BountyCountdown deadline="2026-06-07T12:45:00Z" />);
    expect(screen.getByTestId('bounty-countdown')).toHaveTextContent('0h 45m');
    expect(screen.getByTestId('bounty-countdown')).toHaveClass('text-status-error');

    rerender(<BountyCountdown deadline="2026-06-07T11:59:00Z" />);
    expect(screen.getByTestId('bounty-countdown')).toHaveTextContent('Expired');
  });
});
