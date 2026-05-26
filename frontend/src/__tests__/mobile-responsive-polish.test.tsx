import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { BountyCard } from '../components/bounty/BountyCard';
import { HeroSection } from '../components/home/HeroSection';
import { Navbar } from '../components/layout/Navbar';
import type { Bounty } from '../types/bounty';

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    logout: vi.fn(),
  }),
}));

vi.mock('../hooks/useStats', () => ({
  useStats: () => ({
    data: {
      open_bounties: 42,
      total_paid_usdc: 24500,
      total_contributors: 89,
    },
  }),
}));

const bounty: Bounty = {
  id: 'bounty-824',
  title: 'Polish mobile responsive bounty cards with a very long title that should wrap cleanly',
  description: 'Mobile polish test bounty',
  status: 'open',
  tier: 'T1',
  reward_amount: 150000,
  reward_token: 'FNDRY',
  github_issue_url: 'https://github.com/SolFoundry/solfoundry/issues/824',
  org_name: 'SolFoundryWithAnExtremelyLongOrganizationName',
  repo_name: 'solfoundry-with-a-long-repository-name',
  issue_number: 824,
  skills: ['TypeScript', 'React', 'TailwindCSSWithLongLabel'],
  deadline: new Date(Date.now() + 3 * 864e5).toISOString(),
  submission_count: 12,
  created_at: new Date().toISOString(),
};

beforeAll(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class IntersectionObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    },
  );
});

afterAll(() => {
  vi.unstubAllGlobals();
});

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('mobile responsive polish', () => {
  it('keeps bounty card rows wrapping inside narrow mobile widths', () => {
    renderWithRouter(<BountyCard bounty={bounty} />);

    const card = screen.getByRole('button', { name: /open bounty/i });
    expect(card).toHaveClass('min-w-0', 'w-full', 'p-4', 'sm:p-5');
    expect(screen.getByText(/SolFoundryWithAnExtremelyLongOrganizationName/)).toHaveClass('break-all');
    expect(screen.getByTestId('bounty-meta')).toHaveClass('flex-wrap');
    expect(screen.getByTestId('bounty-status')).not.toHaveClass('absolute');
  });

  it('opens mobile navigation with accessible hamburger controls and closes on link click', async () => {
    renderWithRouter(<Navbar />);

    const toggle = screen.getByLabelText(/toggle navigation menu/i);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const mobileNav = screen.getByRole('navigation', { name: /mobile navigation/i });
    expect(within(mobileNav).getByText('Bounties')).toBeInTheDocument();

    fireEvent.click(within(mobileNav).getByText('Bounties'));

    await waitFor(() => {
      expect(screen.queryByRole('navigation', { name: /mobile navigation/i })).not.toBeInTheDocument();
    });
  });

  it('lets hero terminal and stats wrap instead of forcing horizontal overflow', () => {
    renderWithRouter(<HeroSection />);

    expect(screen.getByTestId('hero-terminal-command')).toHaveClass('break-words');
    expect(screen.getByTestId('hero-stats')).toHaveClass('flex-wrap');
  });
});
