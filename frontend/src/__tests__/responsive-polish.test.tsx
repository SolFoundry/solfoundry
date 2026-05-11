import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Navbar } from '../components/layout/Navbar';
import { HeroSection } from '../components/home/HeroSection';
import { BountyCard } from '../components/bounty/BountyCard';
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
      open_bounties: 12,
      total_paid_usdc: 24500,
      total_contributors: 89,
    },
  }),
}));

vi.mock('../api/auth', () => ({
  getGitHubAuthorizeUrl: vi.fn(),
}));

beforeAll(() => {
  Object.defineProperty(window, 'scrollTo', {
    configurable: true,
    value: vi.fn(),
  });

  const MockIntersectionObserver = vi.fn(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
    takeRecords: () => [],
  }));

  Object.defineProperty(window, 'IntersectionObserver', {
    configurable: true,
    value: MockIntersectionObserver,
  });
  Object.defineProperty(globalThis, 'IntersectionObserver', {
    configurable: true,
    value: MockIntersectionObserver,
  });
});

const bounty: Bounty = {
  id: 'bounty-1',
  title: 'Fix a very long mobile responsive issue title without creating horizontal page overflow',
  description: 'Mobile polish test bounty',
  status: 'open',
  tier: 'T1',
  reward_amount: 150000,
  reward_token: 'FNDRY',
  creator_id: 'user-1',
  submission_count: 7,
  created_at: new Date().toISOString(),
  github_issue_url: 'https://github.com/SolFoundry/solfoundry/issues/833',
  skills: ['TypeScript', 'JavaScript', 'Solidity'],
};

describe('responsive polish', () => {
  it('opens and closes the mobile hamburger menu accessibly', async () => {
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );

    const openButton = screen.getByRole('button', { name: /open navigation menu/i });
    expect(openButton).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(openButton);

    const closeButton = screen.getByRole('button', { name: /close navigation menu/i });
    expect(closeButton).toHaveAttribute('aria-expanded', 'true');
    const mobileMenu = document.getElementById('mobile-nav-menu');
    expect(mobileMenu).toBeInTheDocument();
    expect(within(mobileMenu as HTMLElement).getByRole('link', { name: /bounties/i })).toBeInTheDocument();

    await userEvent.click(closeButton);
    expect(screen.getByRole('button', { name: /open navigation menu/i })).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps the hero terminal command readable on small screens', () => {
    render(
      <MemoryRouter>
        <HeroSection />
      </MemoryRouter>,
    );

    expect(screen.getByText('forge bounty --reward 100 --tier 2')).toBeInTheDocument();
    expect(screen.getByText('forge bounty --reward 100 --lang typescript --tier 2')).toBeInTheDocument();
  });

  it('renders bounty card metadata without absolute-positioned mobile footer content', () => {
    render(
      <MemoryRouter>
        <BountyCard bounty={bounty} />
      </MemoryRouter>,
    );

    expect(screen.getByText('150,000 FNDRY')).toBeInTheDocument();
    expect(screen.getByText('Open')).not.toHaveClass('absolute');
  });
});
