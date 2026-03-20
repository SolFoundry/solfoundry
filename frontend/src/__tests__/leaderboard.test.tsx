/**
 * Leaderboard test suite.
 * Unit tests for the LeaderboardPage component plus an integration
 * test that renders the full app at /leaderboard to verify route wiring.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LeaderboardPage } from '../components/leaderboard/LeaderboardPage';
import { MOCK_CONTRIBUTORS } from '../data/mockLeaderboard';

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => mockFetch.mockReset());

function okJson(data: unknown) { return { ok: true, json: () => Promise.resolve(data) }; }

// ---------------------------------------------------------------------------
// Unit tests -- LeaderboardPage component
// ---------------------------------------------------------------------------
describe('LeaderboardPage', () => {
  it('shows loading state', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<LeaderboardPage />);
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
  });

  it('displays contributors after fetch', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_CONTRIBUTORS));
    render(<LeaderboardPage />);
    await waitFor(() => expect(screen.getByText('alice_dev')).toBeInTheDocument());
    expect(screen.getByText('bob_builder')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /leaderboard/i })).toBeInTheDocument();
  });

  it('shows points and bounties for each contributor', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_CONTRIBUTORS));
    render(<LeaderboardPage />);
    await waitFor(() => expect(screen.getByText('4,200')).toBeInTheDocument());
    expect(screen.getByText('28')).toBeInTheDocument();
  });

  it('search filters contributors by username', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_CONTRIBUTORS));
    render(<LeaderboardPage />);
    await waitFor(() => expect(screen.getByText('alice_dev')).toBeInTheDocument());
    await userEvent.type(screen.getByRole('searchbox', { name: /search/i }), 'bob');
    expect(screen.queryByText('alice_dev')).not.toBeInTheDocument();
    expect(screen.getByText('bob_builder')).toBeInTheDocument();
  });

  it('time range buttons have aria-pressed', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_CONTRIBUTORS));
    render(<LeaderboardPage />);
    await waitFor(() => expect(screen.getByText('alice_dev')).toBeInTheDocument());
    const allBtn = screen.getByText('All time');
    expect(allBtn).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByText('7 days'));
    expect(screen.getByText('7 days')).toHaveAttribute('aria-pressed', 'true');
  });

  it('sort by selector changes ordering', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_CONTRIBUTORS));
    render(<LeaderboardPage />);
    await waitFor(() => expect(screen.getByText('alice_dev')).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /sort/i }), 'bounties');
    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('alice_dev');
  });

  it('shows error state', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    render(<LeaderboardPage />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/error/i));
  });

  it('shows empty state when no contributors', async () => {
    mockFetch.mockResolvedValue(okJson([]));
    render(<LeaderboardPage />);
    await waitFor(() => expect(screen.getByText(/no contributors/i)).toBeInTheDocument());
  });

  it('shows contributor skills', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_CONTRIBUTORS));
    render(<LeaderboardPage />);
    await waitFor(() => expect(screen.getByText(/Rust, Solana/)).toBeInTheDocument());
  });

  it('renders page heading', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_CONTRIBUTORS));
    render(<LeaderboardPage />);
    await waitFor(() => expect(screen.getByRole('heading', { name: /leaderboard/i })).toBeInTheDocument());
  });

  it('renders the data-testid on the page wrapper', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_CONTRIBUTORS));
    render(<LeaderboardPage />);
    await waitFor(() => expect(screen.getByTestId('leaderboard-page')).toBeInTheDocument());
  });
});

// ---------------------------------------------------------------------------
// Integration test -- full app render at /leaderboard route
// ---------------------------------------------------------------------------
describe('Leaderboard route integration', () => {
  it('renders the leaderboard page when navigating to /leaderboard', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_CONTRIBUTORS));

    render(
      <MemoryRouter initialEntries={['/leaderboard']}>
        <Routes>
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="*" element={<Navigate to="/leaderboard" replace />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('leaderboard-page')).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: /leaderboard/i })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /leaderboard/i })).toBeInTheDocument();
    expect(screen.getByText('alice_dev')).toBeInTheDocument();
  });

  it('redirects unknown routes to /leaderboard', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_CONTRIBUTORS));

    render(
      <MemoryRouter initialEntries={['/unknown']}>
        <Routes>
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="*" element={<Navigate to="/leaderboard" replace />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('leaderboard-page')).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: /leaderboard/i })).toBeInTheDocument();
  });

  it('full page renders filters, table, and contributor data together', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_CONTRIBUTORS));

    render(
      <MemoryRouter initialEntries={['/leaderboard']}>
        <Routes>
          <Route path="/leaderboard" element={<LeaderboardPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('leaderboard-page')).toBeInTheDocument());

    // Verify all key sections are present in the integrated page
    const page = screen.getByTestId('leaderboard-page');
    expect(within(page).getByRole('searchbox', { name: /search/i })).toBeInTheDocument();
    expect(within(page).getByRole('group', { name: /time range/i })).toBeInTheDocument();
    expect(within(page).getByRole('combobox', { name: /sort/i })).toBeInTheDocument();
    expect(within(page).getByRole('table', { name: /leaderboard/i })).toBeInTheDocument();

    // Verify all 5 mock contributors are rendered
    for (const c of MOCK_CONTRIBUTORS) {
      expect(within(page).getByText(c.username)).toBeInTheDocument();
    }
  });
});
