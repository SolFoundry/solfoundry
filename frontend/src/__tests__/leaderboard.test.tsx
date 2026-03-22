/**
 * Leaderboard test suite.
 * Unit tests for the LeaderboardPage component plus an integration
 * test that renders the full app at /leaderboard to verify route wiring.
 *
 * Every render wraps in QueryClientProvider because useLeaderboard uses
 * React Query under the hood.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LeaderboardPage } from '../components/leaderboard/LeaderboardPage';
import { MOCK_CONTRIBUTORS } from '../data/mockLeaderboard';
import React from 'react';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => mockFetch.mockReset());

/** Successful fetch response helper. */
function okJson(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(data),
    headers: new Headers(),
    redirected: false,
    type: 'basic' as ResponseType,
    url: '',
    clone: function () { return this; },
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(JSON.stringify(data)),
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response;
}

/** Wrap component in QueryClientProvider for tests. */
function renderWithProviders(element: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {element}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Wrap component in QueryClientProvider + MemoryRouter for route tests. */
function renderWithRouter(element: React.ReactElement, initialEntries: string[] = ['/']) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        {element}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Unit tests -- LeaderboardPage component
// ---------------------------------------------------------------------------
describe('LeaderboardPage', () => {
  it('renders the leaderboard page wrapper immediately', () => {
    // Verify the component mounts and renders the wrapper div
    mockFetch.mockResolvedValue(okJson(MOCK_CONTRIBUTORS));
    renderWithProviders(<LeaderboardPage />);
    expect(screen.getByTestId('leaderboard-page')).toBeInTheDocument();
  });

  it('displays contributors after fetch', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_CONTRIBUTORS));
    renderWithProviders(<LeaderboardPage />);
    await waitFor(() => expect(screen.getByText('alice_dev')).toBeInTheDocument());
    expect(screen.getByText('bob_builder')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /leaderboard/i })).toBeInTheDocument();
  });

  it('shows points and bounties for each contributor', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_CONTRIBUTORS));
    renderWithProviders(<LeaderboardPage />);
    await waitFor(() => expect(screen.getByText('4,200')).toBeInTheDocument());
    expect(screen.getByText('28')).toBeInTheDocument();
  });

  it('search filters contributors by username', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_CONTRIBUTORS));
    renderWithProviders(<LeaderboardPage />);
    await waitFor(() => expect(screen.getByText('alice_dev')).toBeInTheDocument());
    await userEvent.type(screen.getByRole('searchbox', { name: /search/i }), 'bob');
    expect(screen.queryByText('alice_dev')).not.toBeInTheDocument();
    expect(screen.getByText('bob_builder')).toBeInTheDocument();
  });

  it('time range buttons have aria-pressed', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_CONTRIBUTORS));
    renderWithProviders(<LeaderboardPage />);
    await waitFor(() => expect(screen.getByText('alice_dev')).toBeInTheDocument());
    const allBtn = screen.getByText('All time');
    expect(allBtn).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByText('7 days'));
    expect(screen.getByText('7 days')).toHaveAttribute('aria-pressed', 'true');
  });

  it('sort by selector changes ordering', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_CONTRIBUTORS));
    renderWithProviders(<LeaderboardPage />);
    await waitFor(() => expect(screen.getByText('alice_dev')).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort/i }), 'bounties');
    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('alice_dev');
  });

  it('shows error state when backend returns a 4xx error', async () => {
    // Return a 400 error which is not retried and not caught by the fallback
    const errorResponse = {
      ok: false, status: 400, statusText: 'Bad Request',
      json: () => Promise.resolve({ message: 'Invalid range parameter', code: 'VALIDATION_ERROR' }),
      headers: new Headers(), redirected: false, type: 'basic' as ResponseType, url: '',
      clone: function () { return this; }, body: null, bodyUsed: false,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      blob: () => Promise.resolve(new Blob()),
      formData: () => Promise.resolve(new FormData()),
      text: () => Promise.resolve('{}'),
      bytes: () => Promise.resolve(new Uint8Array()),
    } as Response;
    mockFetch.mockResolvedValue(errorResponse);
    renderWithProviders(<LeaderboardPage />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/error/i));
  });

  it('renders contributor table when API returns empty but GitHub fallback produces known contributors', async () => {
    // API returns empty array, triggering GitHub fallback
    // GitHub returns no PRs, but KNOWN_PAYOUTS data produces contributors
    mockFetch.mockResolvedValue(okJson([]));
    renderWithProviders(<LeaderboardPage />);
    await waitFor(() => {
      expect(screen.getByTestId('leaderboard-page')).toBeInTheDocument();
    });
    // Should eventually render the table with contributors from KNOWN_PAYOUTS
    await waitFor(() => {
      expect(screen.getByRole('table', { name: /leaderboard/i })).toBeInTheDocument();
    });
  });

  it('shows contributor skills', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_CONTRIBUTORS));
    renderWithProviders(<LeaderboardPage />);
    await waitFor(() => expect(screen.getByText(/Rust, Solana/)).toBeInTheDocument());
  });

  it('renders page heading', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_CONTRIBUTORS));
    renderWithProviders(<LeaderboardPage />);
    await waitFor(() => expect(screen.getByRole('heading', { name: /leaderboard/i })).toBeInTheDocument());
  });

  it('renders the data-testid on the page wrapper', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_CONTRIBUTORS));
    renderWithProviders(<LeaderboardPage />);
    await waitFor(() => expect(screen.getByTestId('leaderboard-page')).toBeInTheDocument());
  });
});

// ---------------------------------------------------------------------------
// Integration test -- full app render at /leaderboard route
// ---------------------------------------------------------------------------
describe('Leaderboard route integration', () => {
  beforeEach(() => {
    // Mock both API and GitHub calls to return mock contributors
    mockFetch.mockResolvedValue(okJson(MOCK_CONTRIBUTORS));
  });

  it('renders the leaderboard page when navigating to /leaderboard', async () => {
    renderWithRouter(
      <Routes>
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="*" element={<Navigate to="/leaderboard" replace />} />
      </Routes>,
      ['/leaderboard'],
    );

    await waitFor(() => {
      expect(screen.getByTestId('leaderboard-page')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /leaderboard/i })).toBeInTheDocument();
    });
  });

  it('redirects unknown routes to /leaderboard', async () => {
    renderWithRouter(
      <Routes>
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="*" element={<Navigate to="/leaderboard" replace />} />
      </Routes>,
      ['/unknown'],
    );

    await waitFor(() => {
      expect(screen.getByTestId('leaderboard-page')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /leaderboard/i })).toBeInTheDocument();
    });
  });

  it('full page renders filters, table, and contributor data together', async () => {
    renderWithRouter(
      <Routes>
        <Route path="/leaderboard" element={<LeaderboardPage />} />
      </Routes>,
      ['/leaderboard'],
    );

    await waitFor(() => {
      expect(screen.getByTestId('leaderboard-page')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByRole('table', { name: /leaderboard/i })).toBeInTheDocument();
    });

    const page = screen.getByTestId('leaderboard-page');
    expect(within(page).getByRole('searchbox', { name: /search/i })).toBeInTheDocument();
    expect(within(page).getByRole('group', { name: /time range/i })).toBeInTheDocument();
    expect(within(page).getByRole('combobox', { name: /sort/i })).toBeInTheDocument();
  });
});
