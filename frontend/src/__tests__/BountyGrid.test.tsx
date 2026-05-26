import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BountyGrid } from '../components/bounty/BountyGrid';
import { useInfiniteBounties } from '../hooks/useBounties';
import type { Bounty } from '../types/bounty';

vi.mock('../hooks/useBounties', () => ({
  useInfiniteBounties: vi.fn(),
}));

vi.mock('../components/bounty/BountyCard', () => ({
  BountyCard: ({ bounty }: { bounty: Bounty }) => <article>{bounty.title}</article>,
}));

const mockBounty: Bounty = {
  id: 'bounty-1',
  title: 'Rust parser bounty',
  description: 'Build a parser for bounty tags',
  status: 'open',
  tier: 'T1',
  reward_amount: 100000,
  reward_token: 'FNDRY',
  skills: ['Rust'],
  submission_count: 0,
  created_at: '2026-05-01T00:00:00Z',
};

const mockedUseInfiniteBounties = vi.mocked(useInfiniteBounties);

describe('BountyGrid search', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'IntersectionObserver',
      vi.fn(() => ({
        disconnect: vi.fn(),
        observe: vi.fn(),
        takeRecords: vi.fn(() => []),
        unobserve: vi.fn(),
      })),
    );
    mockedUseInfiniteBounties.mockReturnValue({
      data: { pages: [{ items: [mockBounty], total: 1, limit: 12, offset: 0 }], pageParams: [0] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useInfiniteBounties>);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('debounces search and keeps status and language filters in the bounty query', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <BountyGrid />
      </MemoryRouter>,
    );

    expect(screen.getByRole('searchbox', { name: /search bounties/i })).toBeInTheDocument();
    expect(mockedUseInfiniteBounties).toHaveBeenLastCalledWith({
      q: undefined,
      status: 'open',
      skill: undefined,
    });

    await user.type(screen.getByRole('searchbox', { name: /search bounties/i }), 'rust');
    await waitFor(() =>
      expect(mockedUseInfiniteBounties).toHaveBeenLastCalledWith({
        q: 'rust',
        status: 'open',
        skill: undefined,
      }),
    );

    await user.click(screen.getByRole('button', { name: 'TypeScript' }));
    expect(mockedUseInfiniteBounties).toHaveBeenLastCalledWith({
      q: 'rust',
      status: 'open',
      skill: 'TypeScript',
    });

    await user.click(screen.getByRole('button', { name: /clear bounty search/i }));
    expect(mockedUseInfiniteBounties).toHaveBeenLastCalledWith({
      q: undefined,
      status: 'open',
      skill: 'TypeScript',
    });
  });
});
