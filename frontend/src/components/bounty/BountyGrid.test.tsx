import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { BountyGrid } from './BountyGrid';
import type { Bounty } from '../../types/bounty';
import { useInfiniteBounties } from '../../hooks/useBounties';

vi.mock('../../hooks/useBounties', () => ({
  useInfiniteBounties: vi.fn(),
}));

beforeAll(() => {
  class MockIntersectionObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }

  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
});

const baseBounty: Bounty = {
  id: '1',
  title: 'Add Stripe checkout',
  description: 'Implement payment flow',
  status: 'open',
  tier: 'T1',
  reward_amount: 100000,
  reward_token: 'FNDRY',
  skills: ['TypeScript', 'React'],
  submission_count: 0,
  created_at: '2026-05-01T00:00:00Z',
};

function renderGrid(items: Bounty[]) {
  vi.mocked(useInfiniteBounties).mockReturnValue({
    data: { pages: [{ items, total: items.length, limit: 12, offset: 0 }], pageParams: [0] },
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    isError: false,
  } as ReturnType<typeof useInfiniteBounties>);

  render(
    <MemoryRouter>
      <BountyGrid />
    </MemoryRouter>,
  );
}

describe('BountyGrid search', () => {
  it('filters visible bounties by title, description, and tags', async () => {
    const user = userEvent.setup();
    renderGrid([
      baseBounty,
      {
        ...baseBounty,
        id: '2',
        title: 'Rust parser cleanup',
        description: 'Improve parser diagnostics',
        skills: ['Rust'],
      },
    ]);

    expect(screen.getByText('Add Stripe checkout')).toBeInTheDocument();
    expect(screen.getByText('Rust parser cleanup')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Search bounties'), 'stripe');

    await waitFor(() => {
      expect(screen.getByText('Add Stripe checkout')).toBeInTheDocument();
      expect(screen.queryByText('Rust parser cleanup')).not.toBeInTheDocument();
    });

    await user.clear(screen.getByLabelText('Search bounties'));
    await user.type(screen.getByLabelText('Search bounties'), 'rust');

    await waitFor(() => {
      expect(screen.queryByText('Add Stripe checkout')).not.toBeInTheDocument();
      expect(screen.getByText('Rust parser cleanup')).toBeInTheDocument();
    });
  });

  it('clears the search query', async () => {
    const user = userEvent.setup();
    renderGrid([baseBounty]);

    await user.type(screen.getByLabelText('Search bounties'), 'missing');
    await waitFor(() => expect(screen.getByText('No bounties found')).toBeInTheDocument());

    await user.click(screen.getByLabelText('Clear bounty search'));

    await waitFor(() => {
      expect(screen.getByText('Add Stripe checkout')).toBeInTheDocument();
    });
  });
});
