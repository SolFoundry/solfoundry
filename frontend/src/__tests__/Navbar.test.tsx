import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
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

function renderNavbar(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <Navbar />
              <div>page content</div>
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Navbar mobile menu', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn();
  });

  it('toggles the mobile menu and closes it after navigation', async () => {
    const user = userEvent.setup();
    renderNavbar('/');

    const toggle = screen.getByRole('button', { name: /open navigation menu/i });
    await user.click(toggle);

    const leaderboardLink = screen.getAllByRole('link', { name: 'Leaderboard' }).find((link) =>
      link.closest('div')?.className.includes('flex flex-col'),
    );

    expect(leaderboardLink).toBeDefined();
    await user.click(leaderboardLink!);

    expect(screen.queryByRole('button', { name: /close navigation menu/i })).not.toBeInTheDocument();
  });
});
