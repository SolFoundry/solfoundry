import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BountyCard } from '../components/bounty/BountyCard';
import { Navbar } from '../components/layout/Navbar';
import type { Bounty } from '../types/bounty';

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    user: null,
    logout: vi.fn(),
  }),
}));

vi.mock('../hooks/useStats', () => ({
  useStats: () => ({
    data: { open_bounties: 12 },
  }),
}));

vi.mock('../api/auth', () => ({
  getGitHubAuthorizeUrl: vi.fn(),
}));

const bounty: Bounty = {
  id: 'bounty-833',
  title: 'Polish mobile responsive bounty cards with a long title that must wrap cleanly',
  description: 'Make narrow viewport layouts readable without forcing horizontal page scroll.',
  status: 'open',
  tier: 'T1',
  reward_amount: 150000,
  reward_token: 'FNDRY',
  submission_count: 7,
  deadline: new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString(),
  skills: ['TypeScript', 'Rust', 'Solidity'],
  created_at: new Date().toISOString(),
};

afterEach(() => {
  document.body.style.overflow = '';
});

describe('mobile responsive polish', () => {
  it('keeps bounty card footer content in normal layout flow on small screens', () => {
    render(
      <MemoryRouter>
        <BountyCard bounty={bounty} />
      </MemoryRouter>,
    );

    const card = screen.getByText(/polish mobile responsive/i).closest('.rounded-xl');
    expect(card).toHaveClass('p-4', 'sm:p-5', 'min-w-0');

    const status = screen.getByText('Open').closest('span');
    expect(status?.className).not.toContain('absolute');
  });

  it('exposes an accessible mobile menu toggle and locks page scroll while open', () => {
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );

    const toggle = screen.getByRole('button', { name: /open navigation menu/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(document.body.style.overflow).toBe('hidden');
    expect(screen.getByRole('button', { name: /close navigation menu/i })).toBeInTheDocument();
  });
});
