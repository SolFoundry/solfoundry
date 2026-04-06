import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BountyCard } from '../components/bounty/BountyCard';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { HeroSection } from '../components/home/HeroSection';

vi.mock('../hooks/useStats', () => ({
  useStats: () => ({ data: { open_bounties: 12, total_paid_usdc: 3400, total_contributors: 7 } }),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: false, user: null, logout: vi.fn() }),
}));

vi.mock('../api/auth', () => ({
  getGitHubAuthorizeUrl: vi.fn(),
}));

const bounty = {
  id: '1',
  title: 'A very long bounty title that should wrap correctly on smaller mobile screens without causing horizontal overflow or layout breakage',
  description: 'desc',
  status: 'open' as const,
  tier: 'T1' as const,
  reward_amount: 150,
  reward_token: 'FNDRY' as const,
  org_name: 'SolFoundry',
  repo_name: 'solfoundry',
  issue_number: 824,
  skills: ['TypeScript', 'React', 'JavaScript'],
  deadline: new Date(Date.now() + 86400000).toISOString(),
  submission_count: 3,
  created_at: new Date().toISOString(),
};

function withProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('responsive polish', () => {
  it('renders bounty card content without losing key mobile information', () => {
    withProviders(<BountyCard bounty={bounty} />);
    expect(screen.getByText(/A very long bounty title/)).toBeInTheDocument();
    expect(screen.getByText('150 FNDRY')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it('renders navbar mobile and sign-in controls', () => {
    withProviders(<Navbar />);
    expect(screen.getByText('Sign in')).toBeInTheDocument();
    expect(screen.getAllByRole('button').length).toBeGreaterThan(1);
  });

  it('renders hero CTAs and stats', () => {
    withProviders(<HeroSection />);
    expect(screen.getByText('Browse Bounties')).toBeInTheDocument();
    expect(screen.getByText('Post a Bounty')).toBeInTheDocument();
  });

  it('renders footer token contract section without overflow-only content loss', () => {
    withProviders(<Footer />);
    expect(screen.getByText('$FNDRY Token')).toBeInTheDocument();
    expect(screen.getByTitle('Copy contract address')).toBeInTheDocument();
  });
});
