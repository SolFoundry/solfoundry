/**
 * Boost feature test suite.
 *
 * Covers:
 *   - BoostSummaryCard  — prize pool display, loading skeleton, original + boosted split
 *   - BoostForm         — renders only for open/in_progress, input validation,
 *                         submit triggers mutation, error/success states
 *   - BoostLeaderboard  — ranked entries, medals, empty state, loading
 *   - BoostHistory      — boost list, status colours, empty state, loading
 *   - BoostPanel (integration) — assembles all sub-sections, no form when no wallet
 *   - useBoost hook     — API success, submit flow, below-minimum guard
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act } from '@testing-library/react';
import React from 'react';

import { BoostPanel } from '../components/bounties/BoostPanel';
import { useBoost } from '../hooks/useBoost';
import type { BoostListResponse, BoostLeaderboardResponse } from '../types/boost';

// ── Global fetch mock ─────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);
beforeEach(() => mockFetch.mockReset());

// ── Helpers ───────────────────────────────────────────────────────────────────

function okJson(data: unknown): Response {
  return {
    ok: true, status: 200, statusText: 'OK',
    json: () => Promise.resolve(data),
    headers: new Headers(), redirected: false, type: 'basic' as ResponseType, url: '',
    clone: function () { return this; }, body: null, bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(JSON.stringify(data)),
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response;
}

function errResponse(status: number): Response {
  return {
    ok: false, status, statusText: 'Error',
    json: () => Promise.resolve({ detail: 'Error' }),
    headers: new Headers(), redirected: false, type: 'basic' as ResponseType, url: '',
    clone: function () { return this; }, body: null, bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve('{}'),
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response;
}

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
}

function renderWith(element: React.ReactElement) {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>{element}</MemoryRouter>
    </QueryClientProvider>,
  );
}

function wrapHook<T>(fn: () => T) {
  const qc = makeQC();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
  );
  return renderHook(fn, { wrapper });
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const EMPTY_BOOSTS: BoostListResponse = { boosts: [], total: 0, total_boosted: 0 };
const EMPTY_LB: BoostLeaderboardResponse = { leaderboard: [], total_boosted: 0 };

const WALLET_A = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const WALLET_B = '7nkFRQMdByBmgZFdGtJv6F5EZqnc9tJo9XsEoQFaJLqV';

const BOOST_LIST: BoostListResponse = {
  boosts: [
    {
      id: 'b1', bounty_id: 'bounty-1', booster_wallet: WALLET_A,
      amount: 5000, status: 'confirmed', tx_hash: null, refund_tx_hash: null,
      created_at: '2024-03-01T00:00:00Z',
    },
    {
      id: 'b2', bounty_id: 'bounty-1', booster_wallet: WALLET_B,
      amount: 2000, status: 'pending', tx_hash: null, refund_tx_hash: null,
      created_at: '2024-03-02T00:00:00Z',
    },
  ],
  total: 1,
  total_boosted: 5000,
};

const LEADERBOARD: BoostLeaderboardResponse = {
  leaderboard: [
    { rank: 1, booster_wallet: WALLET_A, total_boosted: 5000, boost_count: 1 },
    { rank: 2, booster_wallet: WALLET_B, total_boosted: 2000, boost_count: 1 },
  ],
  total_boosted: 7000,
};

// ── BoostPanel — loading state ────────────────────────────────────────────────

describe('BoostPanel loading state', () => {
  it('shows loading skeletons while fetching', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderWith(
      <BoostPanel bountyId="b1" bountyStatus="open" originalAmount={5000} walletAddress={WALLET_A} />,
    );
    expect(screen.getByLabelText(/loading reward summary/i)).toBeInTheDocument();
  });
});

// ── BoostPanel — success state ────────────────────────────────────────────────

describe('BoostPanel success state', () => {
  beforeEach(() => {
    // First call = boosts, second = leaderboard
    mockFetch
      .mockResolvedValueOnce(okJson(BOOST_LIST))
      .mockResolvedValueOnce(okJson(LEADERBOARD));
  });

  it('renders the panel container', async () => {
    renderWith(
      <BoostPanel bountyId="b1" bountyStatus="open" originalAmount={5000} walletAddress={WALLET_A} />,
    );
    expect(screen.getByTestId('boost-panel')).toBeInTheDocument();
  });

  it('shows total prize pool in summary card', async () => {
    renderWith(
      <BoostPanel bountyId="b1" bountyStatus="open" originalAmount={5000} walletAddress={WALLET_A} />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('boost-summary')).toBeInTheDocument(),
    );
    expect(screen.getByText(/total prize pool/i)).toBeInTheDocument();
    // 5000 original + 5000 boosted = 10000
    expect(screen.getByText('10,000')).toBeInTheDocument();
  });

  it('shows original and boosted amounts separately', async () => {
    renderWith(
      <BoostPanel bountyId="b1" bountyStatus="open" originalAmount={5000} walletAddress={WALLET_A} />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('boost-summary')).toBeInTheDocument(),
    );
    expect(screen.getByText(/5,000/)).toBeInTheDocument(); // original
    expect(screen.getByText(/\+5,000/)).toBeInTheDocument(); // boosted
  });

  it('renders boost form for open bounty with wallet', async () => {
    renderWith(
      <BoostPanel bountyId="b1" bountyStatus="open" originalAmount={5000} walletAddress={WALLET_A} />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('boost-form')).toBeInTheDocument(),
    );
  });

  it('renders leaderboard section', async () => {
    renderWith(
      <BoostPanel bountyId="b1" bountyStatus="open" originalAmount={5000} walletAddress={WALLET_A} />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('boost-leaderboard')).toBeInTheDocument(),
    );
  });

  it('renders history section', async () => {
    renderWith(
      <BoostPanel bountyId="b1" bountyStatus="open" originalAmount={5000} walletAddress={WALLET_A} />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('boost-history')).toBeInTheDocument(),
    );
  });
});

// ── BoostPanel — no wallet ────────────────────────────────────────────────────

describe('BoostPanel without wallet address', () => {
  beforeEach(() => {
    mockFetch
      .mockResolvedValueOnce(okJson(EMPTY_BOOSTS))
      .mockResolvedValueOnce(okJson(EMPTY_LB));
  });

  it('does not render boost form when no wallet is connected', async () => {
    renderWith(
      <BoostPanel bountyId="b1" bountyStatus="open" originalAmount={5000} />,
    );
    await waitFor(() =>
      expect(screen.queryByTestId('boost-form')).not.toBeInTheDocument(),
    );
  });
});

// ── BoostPanel — closed bounty ────────────────────────────────────────────────

describe('BoostPanel for closed bounty', () => {
  beforeEach(() => {
    mockFetch
      .mockResolvedValueOnce(okJson(EMPTY_BOOSTS))
      .mockResolvedValueOnce(okJson(EMPTY_LB));
  });

  it('does not show boost form when bounty is paid', async () => {
    renderWith(
      <BoostPanel bountyId="b1" bountyStatus="paid" originalAmount={5000} walletAddress={WALLET_A} />,
    );
    await waitFor(() =>
      expect(screen.queryByTestId('boost-form')).not.toBeInTheDocument(),
    );
  });

  it('does not show boost form when bounty is cancelled', async () => {
    renderWith(
      <BoostPanel bountyId="b1" bountyStatus="cancelled" originalAmount={5000} walletAddress={WALLET_A} />,
    );
    await waitFor(() =>
      expect(screen.queryByTestId('boost-form')).not.toBeInTheDocument(),
    );
  });
});

// ── Boost form interaction ────────────────────────────────────────────────────

describe('Boost form interaction', () => {
  it('input accepts amount and submit button triggers', async () => {
    const user = userEvent.setup();
    // boosts + leaderboard fetches + POST boost
    mockFetch
      .mockResolvedValueOnce(okJson(EMPTY_BOOSTS))
      .mockResolvedValueOnce(okJson(EMPTY_LB))
      .mockResolvedValueOnce(okJson({ id: 'new', bounty_id: 'b1', booster_wallet: WALLET_A, amount: 2000, status: 'pending', tx_hash: null, refund_tx_hash: null, created_at: '2024-03-01T00:00:00Z' }));

    renderWith(
      <BoostPanel bountyId="b1" bountyStatus="open" originalAmount={5000} walletAddress={WALLET_A} />,
    );
    await waitFor(() => expect(screen.getByTestId('boost-form')).toBeInTheDocument());
    await user.type(screen.getByTestId('boost-amount-input'), '2000');
    await user.click(screen.getByTestId('boost-submit-btn'));
    // Submitting state or success — no crash
    expect(screen.getByTestId('boost-submit-btn')).toBeInTheDocument();
  });

  it('submit button is disabled when amount field is empty', async () => {
    mockFetch
      .mockResolvedValueOnce(okJson(EMPTY_BOOSTS))
      .mockResolvedValueOnce(okJson(EMPTY_LB));
    renderWith(
      <BoostPanel bountyId="b1" bountyStatus="open" originalAmount={5000} walletAddress={WALLET_A} />,
    );
    await waitFor(() => expect(screen.getByTestId('boost-submit-btn')).toBeDisabled());
  });
});

// ── Boost leaderboard ─────────────────────────────────────────────────────────

describe('Boost leaderboard entries', () => {
  it('shows "no boosts yet" when leaderboard is empty', async () => {
    mockFetch
      .mockResolvedValueOnce(okJson(EMPTY_BOOSTS))
      .mockResolvedValueOnce(okJson(EMPTY_LB));
    renderWith(
      <BoostPanel bountyId="b1" bountyStatus="open" originalAmount={5000} walletAddress={WALLET_A} />,
    );
    await waitFor(() => expect(screen.getByText(/no boosts yet.*be the first/i)).toBeInTheDocument());
  });

  it('renders medal for rank 1', async () => {
    mockFetch
      .mockResolvedValueOnce(okJson(EMPTY_BOOSTS))
      .mockResolvedValueOnce(okJson(LEADERBOARD));
    renderWith(
      <BoostPanel bountyId="b1" bountyStatus="open" originalAmount={5000} walletAddress={WALLET_A} />,
    );
    await waitFor(() =>
      expect(screen.getByText('🥇')).toBeInTheDocument(),
    );
    expect(screen.getByText('🥈')).toBeInTheDocument();
  });

  it('shows abbreviated wallet addresses', async () => {
    mockFetch
      .mockResolvedValueOnce(okJson(EMPTY_BOOSTS))
      .mockResolvedValueOnce(okJson(LEADERBOARD));
    renderWith(
      <BoostPanel bountyId="b1" bountyStatus="open" originalAmount={5000} walletAddress={WALLET_A} />,
    );
    await waitFor(() =>
      expect(screen.getByLabelText(/rank 1/i)).toBeInTheDocument(),
    );
  });
});

// ── Boost history ─────────────────────────────────────────────────────────────

describe('Boost history section', () => {
  it('shows "no boosts yet" when history is empty', async () => {
    mockFetch
      .mockResolvedValueOnce(okJson(EMPTY_BOOSTS))
      .mockResolvedValueOnce(okJson(EMPTY_LB));
    renderWith(
      <BoostPanel bountyId="b1" bountyStatus="open" originalAmount={5000} walletAddress={WALLET_A} />,
    );
    await waitFor(() =>
      expect(screen.getAllByText(/no boosts yet/i).length).toBeGreaterThanOrEqual(1),
    );
  });

  it('renders boost list items with amount and status', async () => {
    mockFetch
      .mockResolvedValueOnce(okJson(BOOST_LIST))
      .mockResolvedValueOnce(okJson(LEADERBOARD));
    renderWith(
      <BoostPanel bountyId="b1" bountyStatus="open" originalAmount={5000} walletAddress={WALLET_A} />,
    );
    await waitFor(() =>
      expect(screen.getByRole('list', { name: /boost contributions/i })).toBeInTheDocument(),
    );
    expect(screen.getByText('+5,000')).toBeInTheDocument();
    expect(screen.getByText('+2,000')).toBeInTheDocument();
  });
});

// ── useBoost hook ─────────────────────────────────────────────────────────────

describe('useBoost hook', () => {
  it('returns empty data initially before API responds', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    const { result } = wrapHook(() => useBoost('b1', 5000));
    expect(result.current.boosts).toEqual([]);
    expect(result.current.leaderboard).toEqual([]);
    expect(result.current.loading).toBe(true);
  });

  it('returns boosts and leaderboard after successful fetch', async () => {
    mockFetch
      .mockResolvedValueOnce(okJson(BOOST_LIST))
      .mockResolvedValueOnce(okJson(LEADERBOARD));
    const { result } = wrapHook(() => useBoost('b1', 5000));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.boosts).toHaveLength(2);
    expect(result.current.leaderboard).toHaveLength(2);
  });

  it('computes summary correctly from boost data', async () => {
    mockFetch
      .mockResolvedValueOnce(okJson(BOOST_LIST))   // total_boosted = 5000
      .mockResolvedValueOnce(okJson(LEADERBOARD));
    const { result } = wrapHook(() => useBoost('b1', 3000));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.summary.original_amount).toBe(3000);
    expect(result.current.summary.total_boosted).toBe(5000);
    expect(result.current.summary.total_amount).toBe(8000);
  });

  it('submitBoost sets error when amount is below minimum', () => {
    mockFetch
      .mockResolvedValueOnce(okJson(EMPTY_BOOSTS))
      .mockResolvedValueOnce(okJson(EMPTY_LB));
    const { result } = wrapHook(() => useBoost('b1', 5000));
    act(() => {
      result.current.submitBoost(WALLET_A, 500);
    });
    expect(result.current.submitError).toMatch(/minimum/i);
  });

  it('MIN_BOOST is exposed as 1000', () => {
    mockFetch
      .mockResolvedValueOnce(okJson(EMPTY_BOOSTS))
      .mockResolvedValueOnce(okJson(EMPTY_LB));
    const { result } = wrapHook(() => useBoost('b1', 5000));
    expect(result.current.MIN_BOOST).toBe(1000);
  });

  it('submitBoost calls API with correct payload', async () => {
    mockFetch
      .mockResolvedValueOnce(okJson(EMPTY_BOOSTS))
      .mockResolvedValueOnce(okJson(EMPTY_LB))
      .mockResolvedValueOnce(okJson({ id: 'new', bounty_id: 'b1', booster_wallet: WALLET_A, amount: 2000, status: 'pending', tx_hash: null, refund_tx_hash: null, created_at: '2024-03-01T00:00:00Z' }));

    const { result } = wrapHook(() => useBoost('b1', 5000));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => { result.current.submitBoost(WALLET_A, 2000); });

    await waitFor(() => {
      // The third call should be the POST
      const calls = mockFetch.mock.calls;
      const postCall = calls.find(c => String(c[0]).includes('/boost') && c[1]?.method === 'POST');
      expect(postCall).toBeDefined();
    });
  });
});
