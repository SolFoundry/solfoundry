import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BountyCard } from '../components/bounty/BountyCard';
import { BountyGrid } from '../components/bounty/BountyGrid';
import { ActivityFeed } from '../components/home/ActivityFeed';
import { HeroSection } from '../components/home/HeroSection';
import type { Bounty } from '../types/bounty';

class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

vi.mock('../hooks/useBounties', () => ({
  useInfiniteBounties: () => ({
    data: { pages: [{ items: [], total: 0, limit: 12, offset: 0 }] },
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    isError: false,
  }),
}));

vi.mock('../hooks/useStats', () => ({
  useStats: () => ({
    data: { open_bounties: 12, total_paid_usdc: 3400, total_contributors: 8 },
  }),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: false,
  }),
}));

const bounty: Bounty = {
  id: 'mobile-bounty',
  title: 'Very long mobile responsive bounty title that should wrap cleanly in a narrow card',
  description: 'Make sure bounty cards do not overflow on small screens.',
  status: 'open',
  tier: 'T1',
  reward_amount: 150000,
  reward_token: 'FNDRY',
  github_issue_url: 'https://github.com/SolFoundry/solfoundry/issues/824',
  org_name: 'SolFoundry',
  repo_name: 'solfoundry',
  issue_number: 824,
  skills: ['TypeScript', 'React', 'Tailwind', 'CSS'],
  deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
  submission_count: 7,
  created_at: new Date().toISOString(),
};

function renderRoute(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('mobile responsive polish', () => {
  it('lets bounty card content wrap before desktop positioning kicks in', () => {
    renderRoute(<BountyCard bounty={bounty} />);

    const card = screen.getByText(/very long mobile responsive bounty title/i).closest('div');
    expect(card).toHaveClass('min-w-0', 'p-4', 'sm:p-5');

    const reward = screen.getByText('150,000 FNDRY');
    expect(reward.parentElement).toHaveClass('flex-col', 'sm:flex-row');

    const status = screen.getByText('Open');
    expect(status).toHaveClass('mt-3', 'sm:absolute', 'sm:mt-0');
  });

  it('stacks bounty page actions on mobile and restores inline controls on larger screens', () => {
    renderRoute(<BountyGrid />);

    const postButton = screen.getByRole('link', { name: /post a bounty/i });
    expect(postButton.parentElement).toHaveClass('w-full', 'flex-col', 'sm:flex-row');
    expect(postButton).toHaveClass('justify-center', 'py-2', 'sm:py-1.5');

    const statusFilter = screen.getByRole('combobox');
    expect(statusFilter).toHaveClass('w-full', 'py-2', 'sm:py-1.5');
  });

  it('uses a compact terminal command and wrapped stat row in the mobile hero', () => {
    renderRoute(<HeroSection />);

    expect(screen.getByText('forge bounty --tier 2')).toHaveClass('sm:hidden');
    expect(screen.getByText('forge bounty --reward 100 --lang typescript --tier 2')).toHaveClass('hidden', 'sm:inline-block');
    expect(screen.getByText(/open bounties/i).parentElement).toHaveClass('flex-wrap');
  });

  it('allows activity feed detail text to wrap on narrow screens', () => {
    render(
      <ActivityFeed
        events={[
          {
            id: 'activity-mobile',
            type: 'posted',
            username: 'SolanaLabs',
            detail: 'Bounty #145 - $3,500 USDC',
            timestamp: new Date().toISOString(),
          },
        ]}
      />,
    );

    expect(screen.getByText('SolanaLabs').closest('p')).toHaveClass('min-w-0', 'break-words');
    expect(screen.getByText('Bounty #145 - $3,500 USDC')).toHaveClass('break-words');
  });
});
