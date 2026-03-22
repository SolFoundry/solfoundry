import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ContributorProfileView } from '../components/contributor/ContributorProfileView';
import { ContributorProfileSkeleton } from '../components/contributor/ContributorProfileSkeleton';
import { ContributorNotFound } from '../components/contributor/ContributorNotFound';
import type { ContributorProfile } from '../types/contributor';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function jsonOk(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(data),
    headers: new Headers({ 'content-type': 'application/json' }),
    redirected: false,
    type: 'basic' as ResponseType,
    url: '',
    clone: () => ({}) as Response,
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(''),
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response;
}

function jsonFail(status: number, body: Record<string, string>): Response {
  return {
    ok: false,
    status,
    statusText: 'Error',
    json: () => Promise.resolve(body),
    headers: new Headers(),
    redirected: false,
    type: 'basic' as ResponseType,
    url: '',
    clone: () => ({}) as Response,
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(''),
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response;
}

const MOCK_CONTRIBUTOR: ContributorProfile = {
  username: 'janedoe',
  avatarUrl: 'https://avatars.githubusercontent.com/janedoe',
  joinedAt: '2025-06-15T00:00:00Z',
  walletAddress: '8ab3c7f1e2d4a6b8c0e1f3d5a7b9c1e3f5a7b91fa',
  tier: 'T2',
  bountiesCompleted: 12,
  completedT1: 6,
  completedT2: 4,
  completedT3: 2,
  totalEarnedFndry: 250000,
  reputationScore: 92,
  recentBounties: [
    { id: 'b1', title: 'Fix escrow payout logic', tier: 'T2', completedAt: '2026-03-10T00:00:00Z', reward: 50000, currency: '$FNDRY' },
    { id: 'b2', title: 'Add pagination to bounty board', tier: 'T1', completedAt: '2026-03-05T00:00:00Z', reward: 25000, currency: '$FNDRY' },
    { id: 'b3', title: 'Implement dispute resolution', tier: 'T3', completedAt: '2026-02-20T00:00:00Z', reward: 75000, currency: '$FNDRY' },
  ],
};

function renderInRouter(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      {ui}
    </MemoryRouter>,
  );
}

describe('ContributorProfileView', () => {
  it('renders contributor username and tier badge', () => {
    renderInRouter(<ContributorProfileView contributor={MOCK_CONTRIBUTOR} />);
    expect(screen.getByText('janedoe')).toBeInTheDocument();
    expect(screen.getAllByTestId('tier-badge-T2').length).toBeGreaterThan(0);
  });

  it('renders join date', () => {
    renderInRouter(<ContributorProfileView contributor={MOCK_CONTRIBUTOR} />);
    expect(screen.getByText(/Joined June 2025/)).toBeInTheDocument();
  });

  it('renders wallet address with copy button', () => {
    renderInRouter(<ContributorProfileView contributor={MOCK_CONTRIBUTOR} />);
    expect(screen.getByText(/8ab3.*91fa/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Copy to clipboard/)).toBeInTheDocument();
  });

  it('shows "No wallet connected" when wallet address is empty', () => {
    const noWallet = { ...MOCK_CONTRIBUTOR, walletAddress: '' };
    renderInRouter(<ContributorProfileView contributor={noWallet} />);
    expect(screen.getByText('No wallet connected')).toBeInTheDocument();
  });

  it('renders stat cards with correct values', () => {
    renderInRouter(<ContributorProfileView contributor={MOCK_CONTRIBUTOR} />);
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('92')).toBeInTheDocument();
    expect(screen.getByText(/250,000 \$FNDRY/)).toBeInTheDocument();
    expect(screen.getByText('6 / 4 / 2')).toBeInTheDocument();
  });

  it('renders tier progress section', () => {
    renderInRouter(<ContributorProfileView contributor={MOCK_CONTRIBUTOR} />);
    expect(screen.getByText('Tier Progress')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders recent activity with bounty links', () => {
    renderInRouter(<ContributorProfileView contributor={MOCK_CONTRIBUTOR} />);
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    expect(screen.getByText('Fix escrow payout logic')).toBeInTheDocument();
    expect(screen.getByText('Add pagination to bounty board')).toBeInTheDocument();
    expect(screen.getByText('Implement dispute resolution')).toBeInTheDocument();

    const bountyLink = screen.getByText('Fix escrow payout logic').closest('a');
    expect(bountyLink).toHaveAttribute('href', '/bounties/b1');
  });

  it('shows empty state when no bounties', () => {
    const noBounties = { ...MOCK_CONTRIBUTOR, recentBounties: [] };
    renderInRouter(<ContributorProfileView contributor={noBounties} />);
    expect(screen.getByText('No completed bounties yet.')).toBeInTheDocument();
  });

  it('renders back link to leaderboard', () => {
    renderInRouter(<ContributorProfileView contributor={MOCK_CONTRIBUTOR} />);
    const backLink = screen.getByText(/Back to Leaderboard/);
    expect(backLink.closest('a')).toHaveAttribute('href', '/leaderboard');
  });
});

describe('ContributorProfileSkeleton', () => {
  it('renders with loading role', () => {
    render(<ContributorProfileSkeleton />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders skeleton bones for all sections', () => {
    const { container } = render(<ContributorProfileSkeleton />);
    const bones = container.querySelectorAll('.animate-pulse');
    expect(bones.length).toBeGreaterThan(10);
  });
});

describe('ContributorNotFound', () => {
  it('renders 404 message', () => {
    renderInRouter(<ContributorNotFound />);
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText('Contributor Not Found')).toBeInTheDocument();
  });

  it('renders link back to leaderboard', () => {
    renderInRouter(<ContributorNotFound />);
    const link = screen.getByText(/Back to Leaderboard/);
    expect(link.closest('a')).toHaveAttribute('href', '/leaderboard');
  });
});

describe('ContributorProfilePage integration', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('renders profile after successful API fetch', async () => {
    const apiResponse = {
      username: 'janedoe',
      avatar_url: 'https://avatars.githubusercontent.com/janedoe',
      joined_at: '2025-06-15T00:00:00Z',
      wallet_address: '8ab3c7f1e2d4a6b8c0e1f3d5a7b9c1e3f5a7b91fa',
      tier: 'T2',
      bounties_completed: 12,
      completed_t1: 6,
      completed_t2: 4,
      completed_t3: 2,
      total_earned_fndry: 250000,
      reputation_score: 92,
      recent_bounties: [
        { id: 'b1', title: 'Fix escrow payout logic', tier: 'T2', completed_at: '2026-03-10T00:00:00Z', reward: 50000, currency: '$FNDRY' },
      ],
    };
    mockFetch.mockResolvedValue(jsonOk(apiResponse));

    const ContributorProfilePage = (await import('../pages/ContributorProfilePage')).default;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/contributor/janedoe']}>
          <Routes>
            <Route path="/contributor/:username" element={<ContributorProfilePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('janedoe')).toBeInTheDocument();
    });
    expect(screen.getByText(/250,000/)).toBeInTheDocument();
    expect(screen.getAllByTestId('tier-badge-T2').length).toBeGreaterThan(0);
  });

  it('shows 404 when API returns 404', async () => {
    mockFetch.mockResolvedValue(jsonFail(404, { message: 'Not found', code: 'NOT_FOUND' }));

    const ContributorProfilePage = (await import('../pages/ContributorProfilePage')).default;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/contributor/nobody']}>
          <Routes>
            <Route path="/contributor/:username" element={<ContributorProfilePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Contributor Not Found')).toBeInTheDocument();
    });
  });

  it('shows error state with retry on 500', async () => {
    mockFetch.mockResolvedValue(jsonFail(500, { message: 'Internal server error' }));

    const ContributorProfilePage = (await import('../pages/ContributorProfilePage')).default;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/contributor/janedoe']}>
          <Routes>
            <Route path="/contributor/:username" element={<ContributorProfilePage />} />
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
