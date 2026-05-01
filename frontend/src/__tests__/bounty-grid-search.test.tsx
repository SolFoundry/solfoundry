import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BountyGrid } from '../components/bounty/BountyGrid';
import { useInfiniteBounties } from '../hooks/useBounties';
import type { Bounty } from '../types/bounty';

vi.mock('../hooks/useBounties', () => ({
  useInfiniteBounties: vi.fn(),
}));

const mockUseInfiniteBounties = vi.mocked(useInfiniteBounties);

const bounties: Bounty[] = [
  {
    id: 'bounty-1',
    title: 'Build Rust indexer',
    description: 'Parse on-chain settlement events',
    status: 'open',
    tier: 'T1',
    reward_amount: 100000,
    reward_token: 'FNDRY',
    org_name: 'SolFoundry',
    repo_name: 'solfoundry',
    issue_number: 101,
    category: 'backend',
    skills: ['Rust'],
    submission_count: 0,
    created_at: '2026-05-01T00:00:00Z',
  },
  {
    id: 'bounty-2',
    title: 'Polish React bounty cards',
    description: 'Improve responsive layout and tag spacing',
    status: 'open',
    tier: 'T1',
    reward_amount: 100000,
    reward_token: 'FNDRY',
    org_name: 'SolFoundry',
    repo_name: 'solfoundry',
    issue_number: 102,
    category: 'frontend',
    skills: ['React', 'TypeScript'],
    submission_count: 2,
    created_at: '2026-05-01T00:00:00Z',
  },
];

function renderGrid() {
  return render(
    <MemoryRouter>
      <BountyGrid />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  mockUseInfiniteBounties.mockReturnValue({
    data: { pages: [{ items: bounties, total: bounties.length, limit: 12, offset: 0 }], pageParams: [0] },
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useInfiniteBounties>);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('BountyGrid search', () => {
  it('filters loaded bounties with a debounced search query and clears the query', () => {
    renderGrid();

    expect(screen.getByRole('searchbox', { name: /search bounties/i })).toBeInTheDocument();
    expect(screen.getByText('Build Rust indexer')).toBeInTheDocument();
    expect(screen.getByText('Polish React bounty cards')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox', { name: /search bounties/i }), {
      target: { value: 'responsive' },
    });

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(screen.queryByText('Build Rust indexer')).not.toBeInTheDocument();
    expect(screen.getByText('Polish React bounty cards')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /clear search/i }));
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(screen.getByText('Build Rust indexer')).toBeInTheDocument();
    expect(screen.getByText('Polish React bounty cards')).toBeInTheDocument();
  });

  it('keeps existing status and skill filters in the bounties query', () => {
    renderGrid();

    expect(mockUseInfiniteBounties).toHaveBeenLastCalledWith({ status: 'open', skill: undefined });

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'funded' } });
    fireEvent.click(screen.getByRole('button', { name: 'Python' }));

    expect(mockUseInfiniteBounties).toHaveBeenLastCalledWith({ status: 'funded', skill: 'Python' });
  });
});
