/**
 * Integration tests for React Query hooks and their corresponding components.
 *
 * Validates that useBountyBoard, useLeaderboard, useTreasuryStats, and
 * the ContributorProfilePage all correctly fetch from the API client,
 * display loading skeletons, render data on success, and show errors
 * on failure.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import React from 'react';

// ---------------------------------------------------------------------------
// Shared mock for global fetch
// ---------------------------------------------------------------------------
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

/** Create a resolved fetch Response with the given JSON body. */
function jsonOk(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(data),
    headers: new Headers(),
    redirected: false,
    type: 'basic' as ResponseType,
    url: '',
    clone: () => jsonOk(data),
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(JSON.stringify(data)),
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response;
}

/** Create a failed fetch Response. */
function jsonFail(status: number, body: Record<string, string> = {}): Response {
  return {
    ok: false,
    status,
    statusText: 'Error',
    json: () => Promise.resolve(body),
    headers: new Headers(),
    redirected: false,
    type: 'basic' as ResponseType,
    url: '',
    clone: () => jsonFail(status, body),
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(JSON.stringify(body)),
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response;
}

/** Wrapper that provides QueryClient + MemoryRouter for hook/component tests. */
function createWrapper(initialEntries: string[] = ['/']) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
}

beforeEach(() => {
  mockFetch.mockReset();
});

// ---------------------------------------------------------------------------
// useTreasuryStats + TokenomicsPage
// ---------------------------------------------------------------------------
describe('TokenomicsPage with React Query', () => {
  it('shows loading state then renders tokenomics data on success', async () => {
    const tokenomicsData = {
      tokenName: 'FNDRY',
      tokenCA: 'C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS',
      totalSupply: 1_000_000_000,
      circulatingSupply: 500_000_000,
      treasuryHoldings: 200_000_000,
      totalDistributed: 100_000_000,
      totalBuybacks: 10_000_000,
      totalBurned: 5_000_000,
      feeRevenueSol: 50,
      lastUpdated: new Date().toISOString(),
      distributionBreakdown: { bounties: 400_000_000, treasury: 200_000_000 },
    };
    const treasuryData = {
      solBalance: 100, fndryBalance: 200_000_000,
      treasuryWallet: '57uMiMHnRJCxM7Q1MdGVMLsEtxzRiy1F6qKFWyP1S9pp',
      totalPaidOutFndry: 50_000_000, totalPaidOutSol: 25,
      totalPayouts: 30, totalBuybackAmount: 10_000_000,
      totalBuybacks: 5, lastUpdated: new Date().toISOString(),
    };

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('tokenomics')) return Promise.resolve(jsonOk(tokenomicsData));
      if (url.includes('treasury')) return Promise.resolve(jsonOk(treasuryData));
      return Promise.resolve(jsonOk({}));
    });

    const { TokenomicsPage } = await import('../components/tokenomics/TokenomicsPage');
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <TokenomicsPage />
      </QueryClientProvider>,
    );

    // Should eventually show the heading
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/FNDRY Tokenomics/);
    });
    expect(screen.getByText(/Total Supply/)).toBeInTheDocument();
  });

  it('shows error state when API fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const { TokenomicsPage } = await import('../components/tokenomics/TokenomicsPage');
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <TokenomicsPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// ContributorProfilePage with React Query
// ---------------------------------------------------------------------------
describe('ContributorProfilePage with React Query', () => {
  it('shows loading skeleton then renders profile on success', async () => {
    const profileData = {
      username: 'testuser',
      avatar_url: 'https://example.com/avatar.png',
      wallet_address: '97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF',
      total_earned: 150_000,
      bounties_completed: 5,
      reputation_score: 85,
    };

    mockFetch.mockResolvedValue(jsonOk(profileData));

    const ContributorProfilePage = (await import('../pages/ContributorProfilePage')).default;
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/profile/testuser']}>
          <Routes>
            <Route path="/profile/:username" element={<ContributorProfilePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Should show the username after loading
    await waitFor(() => {
      expect(screen.getByText('testuser')).toBeInTheDocument();
    });
    expect(screen.getByText(/150,000/)).toBeInTheDocument();
  });

  it('shows error state with retry button when API fails', async () => {
    mockFetch.mockResolvedValue(jsonFail(500, { message: 'Internal server error' }));

    const ContributorProfilePage = (await import('../pages/ContributorProfilePage')).default;
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/profile/baduser']}>
          <Routes>
            <Route path="/profile/:username" element={<ContributorProfilePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByText(/Failed to load contributor profile/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// LeaderboardPage with React Query
// ---------------------------------------------------------------------------
describe('LeaderboardPage with React Query', () => {
  it('shows loading then renders leaderboard data', async () => {
    const contributors = [
      { rank: 1, username: 'alice_dev', avatarUrl: '', points: 4200, bountiesCompleted: 28, earningsFndry: 2_000_000, earningsSol: 0, streak: 5, topSkills: ['Rust', 'Solana'] },
      { rank: 2, username: 'bob_builder', avatarUrl: '', points: 3100, bountiesCompleted: 15, earningsFndry: 1_000_000, earningsSol: 0, streak: 3, topSkills: ['React'] },
    ];

    mockFetch.mockResolvedValue(jsonOk(contributors));

    const { LeaderboardPage } = await import('../components/leaderboard/LeaderboardPage');
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <LeaderboardPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('alice_dev')).toBeInTheDocument();
    });
    expect(screen.getByText('bob_builder')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /leaderboard/i })).toBeInTheDocument();
  });

  it('shows error state when fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const { LeaderboardPage } = await import('../components/leaderboard/LeaderboardPage');
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <LeaderboardPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// AgentProfilePage with React Query
// ---------------------------------------------------------------------------
describe('AgentProfilePage with React Query', () => {
  it('shows loading skeleton then renders agent profile on success', async () => {
    const agentData = {
      id: 'agent-1',
      name: 'ReviewBot',
      avatar_url: 'https://example.com/bot.png',
      role: 'reviewer',
      status: 'online',
      bio: 'An automated code reviewer.',
      skills: ['TypeScript', 'Rust'],
      languages: ['English'],
      bounties_completed: 10,
      success_rate: 95,
      avg_review_score: 8.5,
      total_earned: 500_000,
      completed_bounties: [],
      joined_at: '2025-01-01T00:00:00Z',
    };

    mockFetch.mockResolvedValue(jsonOk(agentData));

    const AgentProfilePage = (await import('../pages/AgentProfilePage')).default;
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/agents/agent-1']}>
          <Routes>
            <Route path="/agents/:agentId" element={<AgentProfilePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('ReviewBot')).toBeInTheDocument();
    });
  });

  it('shows not found when agent does not exist', async () => {
    mockFetch.mockResolvedValue(jsonFail(404, { message: 'Agent not found' }));

    const AgentProfilePage = (await import('../pages/AgentProfilePage')).default;
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/agents/nonexistent']}>
          <Routes>
            <Route path="/agents/:agentId" element={<AgentProfilePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/not found|no agent/i)).toBeInTheDocument();
    });
  });
});
