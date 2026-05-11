import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { Bounty } from '../types/bounty';
import { BountyGrid } from '../components/bounty/BountyGrid';

const mockUseInfiniteBounties = vi.hoisted(() => vi.fn());

vi.mock('../hooks/useBounties', () => ({
  useInfiniteBounties: mockUseInfiniteBounties,
}));

vi.mock('../components/bounty/BountyCard', () => ({
  BountyCard: ({ bounty }: { bounty: Bounty }) => (
    <article data-testid={`bounty-card-${bounty.id}`}>{bounty.title}</article>
  ),
}));

const bounties: Bounty[] = [
  {
    id: 'one',
    title: 'Build Rust escrow parser',
    description: 'Parse on-chain escrow events',
    status: 'open',
    tier: 'T1',
    reward_amount: 100000,
    reward_token: 'FNDRY',
    org_name: 'SolFoundry',
    repo_name: 'solfoundry',
    skills: ['Rust'],
    submission_count: 0,
    created_at: new Date().toISOString(),
  },
  {
    id: 'two',
    title: 'Polish bounty cards',
    description: 'Responsive frontend improvements',
    status: 'open',
    tier: 'T1',
    reward_amount: 150000,
    reward_token: 'FNDRY',
    org_name: 'SolFoundry',
    repo_name: 'solfoundry',
    skills: ['TypeScript'],
    submission_count: 0,
    created_at: new Date().toISOString(),
  },
];

function renderGrid() {
  render(
    <MemoryRouter>
      <BountyGrid />
    </MemoryRouter>,
  );
}

describe('BountyGrid search', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    mockUseInfiniteBounties.mockReturnValue({
      data: { pages: [{ items: bounties, total: bounties.length, limit: 12, offset: 0 }] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      isError: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('filters loaded bounties by title, description, repo, and tag text', () => {
    renderGrid();

    expect(screen.getByText('Build Rust escrow parser')).toBeInTheDocument();
    expect(screen.getByText('Polish bounty cards')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox', { name: /search bounties/i }), {
      target: { value: 'typescript' },
    });
    act(() => vi.advanceTimersByTime(250));

    expect(screen.queryByText('Build Rust escrow parser')).not.toBeInTheDocument();
    expect(screen.getByText('Polish bounty cards')).toBeInTheDocument();
  });

  it('clears the search query with the clear button', () => {
    renderGrid();

    fireEvent.change(screen.getByRole('searchbox', { name: /search bounties/i }), {
      target: { value: 'rust' },
    });
    act(() => vi.advanceTimersByTime(250));

    expect(screen.getByText('Build Rust escrow parser')).toBeInTheDocument();
    expect(screen.queryByText('Polish bounty cards')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /clear bounty search/i }));
    act(() => vi.advanceTimersByTime(250));

    expect(screen.getByText('Build Rust escrow parser')).toBeInTheDocument();
    expect(screen.getByText('Polish bounty cards')).toBeInTheDocument();
  });
});
