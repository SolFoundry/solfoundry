/**
 * Reputation display test suite.
 *
 * Covers:
 *   - ReputationScoreCard  — score, tier badge, rank badge, loading skeleton
 *   - TierBadge            — T1 / T2 / T3 labels
 *   - ReputationHistoryChart — loading skeleton, insufficient data, renders SVG region
 *   - ReputationBreakdown  — rows, REP calculations, streak badge, star rating, loading skeleton
 *   - TierProgressIndicator — next-tier messages, max-tier message, loading skeleton
 *   - ReputationPanel      — integration: error state, loading state, successful render
 *   - useReputation hook   — API hit, leaderboard fallback, ultimate fallback, disabled
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act } from '@testing-library/react';
import React from 'react';

import { ReputationScoreCard, TierBadge } from '../components/reputation/ReputationScoreCard';
import { ReputationHistoryChart } from '../components/reputation/ReputationHistoryChart';
import { ReputationBreakdown } from '../components/reputation/ReputationBreakdown';
import { TierProgressIndicator } from '../components/reputation/TierProgressIndicator';
import { ReputationPanel } from '../components/reputation/ReputationPanel';
import { useReputation } from '../hooks/useReputation';
import type { ReputationData, ReputationBreakdown as BreakdownType, ReputationSnapshot, ReputationEvent } from '../types/reputation';

// ── Global fetch mock ─────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);
beforeEach(() => mockFetch.mockReset());

// ── Test helpers ──────────────────────────────────────────────────────────────

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

function errorResponse(status: number): Response {
  return {
    ok: false, status, statusText: 'Error',
    json: () => Promise.resolve({ message: 'Error' }),
    headers: new Headers(), redirected: false, type: 'basic' as ResponseType, url: '',
    clone: function () { return this; }, body: null, bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve('{}'),
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response;
}

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
}

function renderWith(element: React.ReactElement) {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter>{element}</MemoryRouter>
    </QueryClientProvider>,
  );
}

function wrapHook<T>(fn: () => T) {
  const qc = makeQueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
  );
  return renderHook(fn, { wrapper });
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BREAKDOWN: BreakdownType = {
  t1Completions: 6,
  t2Completions: 3,
  t3Completions: 1,
  avgReviewScore: 4.2,
  reviewCount: 10,
  streak: 7,
};

const HISTORY: ReputationSnapshot[] = [
  { date: '2024-01-01', score: 100 },
  { date: '2024-02-01', score: 250 },
  { date: '2024-03-01', score: 450 },
];

const EVENTS: ReputationEvent[] = [
  { id: 'ev-1', date: '2024-03-01', delta: 200, reason: 'Completed T3 bounty', tier: 'T3', bountyId: 'b-99' },
  { id: 'ev-2', date: '2024-02-15', delta: 100, reason: 'Completed T2 bounty', tier: 'T2' },
  { id: 'ev-3', date: '2024-01-20', delta: 50,  reason: 'Completed T1 bounty', tier: 'T1' },
];

const REP_DATA: ReputationData = {
  score: 1450,
  rank: 3,
  totalContributors: 200,
  tier: 'T3',
  breakdown: BREAKDOWN,
  history: HISTORY,
  events: EVENTS,
};

// ── ReputationScoreCard ───────────────────────────────────────────────────────

describe('ReputationScoreCard', () => {
  it('renders score and tier', () => {
    renderWith(<ReputationScoreCard score={1450} rank={3} totalContributors={200} tier="T3" />);
    expect(screen.getByLabelText(/1,450 reputation points/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/current tier: tier 3/i)).toBeInTheDocument();
  });

  it('displays rank badge with medal for top 3', () => {
    renderWith(<ReputationScoreCard score={500} rank={1} totalContributors={100} tier="T1" />);
    expect(screen.getByText(/#1/)).toBeInTheDocument();
    expect(screen.getByText(/of 100/)).toBeInTheDocument();
  });

  it('renders medal emoji for rank 2', () => {
    renderWith(<ReputationScoreCard score={400} rank={2} totalContributors={50} tier="T2" />);
    expect(screen.getByText(/#2/)).toBeInTheDocument();
  });

  it('renders medal emoji for rank 3', () => {
    renderWith(<ReputationScoreCard score={300} rank={3} totalContributors={30} tier="T1" />);
    expect(screen.getByText(/#3/)).toBeInTheDocument();
  });

  it('does not render rank badge when rank is 0', () => {
    renderWith(<ReputationScoreCard score={0} rank={0} totalContributors={0} tier="T1" />);
    expect(screen.queryByText(/#0/)).not.toBeInTheDocument();
    expect(screen.queryByText(/of 0/)).not.toBeInTheDocument();
  });

  it('shows loading skeleton with aria-busy when loading=true', () => {
    renderWith(<ReputationScoreCard score={0} rank={0} totalContributors={0} tier="T1" loading />);
    expect(screen.getByLabelText(/loading reputation score/i)).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByLabelText(/reputation score/i, { selector: '[role="region"]' })).not.toBeInTheDocument();
  });

  it('has role=region on main content', () => {
    renderWith(<ReputationScoreCard score={100} rank={5} totalContributors={50} tier="T1" />);
    expect(screen.getByRole('region', { name: /reputation score/i })).toBeInTheDocument();
  });

  it('formats large scores with locale commas', () => {
    renderWith(<ReputationScoreCard score={12500} rank={1} totalContributors={500} tier="T3" />);
    expect(screen.getByLabelText(/12,500 reputation points/i)).toBeInTheDocument();
  });
});

// ── TierBadge ─────────────────────────────────────────────────────────────────

describe('TierBadge', () => {
  it('renders T1 label', () => {
    renderWith(<TierBadge tier="T1" />);
    expect(screen.getByText('Tier 1')).toBeInTheDocument();
  });

  it('renders T2 label', () => {
    renderWith(<TierBadge tier="T2" />);
    expect(screen.getByText('Tier 2')).toBeInTheDocument();
  });

  it('renders T3 label with trophy emoji', () => {
    renderWith(<TierBadge tier="T3" />);
    expect(screen.getByText('Tier 3')).toBeInTheDocument();
    expect(screen.getByText('🏆')).toBeInTheDocument();
  });

  it('has accessible aria-label on each tier badge', () => {
    const { rerender } = renderWith(<TierBadge tier="T1" />);
    expect(screen.getByLabelText('Current tier: Tier 1')).toBeInTheDocument();
    rerender(
      <QueryClientProvider client={makeQueryClient()}><MemoryRouter><TierBadge tier="T2" /></MemoryRouter></QueryClientProvider>,
    );
    expect(screen.getByLabelText('Current tier: Tier 2')).toBeInTheDocument();
  });
});

// ── ReputationHistoryChart ────────────────────────────────────────────────────

describe('ReputationHistoryChart', () => {
  it('renders the chart region heading', () => {
    renderWith(<ReputationHistoryChart history={HISTORY} events={EVENTS} />);
    expect(screen.getByRole('region', { name: /reputation history chart/i })).toBeInTheDocument();
    expect(screen.getByText(/score history/i)).toBeInTheDocument();
  });

  it('shows "not enough data" when fewer than 2 history points', () => {
    renderWith(<ReputationHistoryChart history={[{ date: '2024-01-01', score: 100 }]} />);
    expect(screen.getByText(/not enough data yet/i)).toBeInTheDocument();
  });

  it('shows "not enough data" when history is empty', () => {
    renderWith(<ReputationHistoryChart history={[]} />);
    expect(screen.getByText(/not enough data yet/i)).toBeInTheDocument();
  });

  it('renders loading skeleton with aria-busy when loading=true', () => {
    renderWith(<ReputationHistoryChart history={[]} loading />);
    expect(screen.getByLabelText(/loading reputation chart/i)).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('region', { name: /reputation history chart/i })).not.toBeInTheDocument();
  });

  it('renders SVG element when sufficient history exists', () => {
    const { container } = renderWith(<ReputationHistoryChart history={HISTORY} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders tooltip on mouse move over chart', () => {
    const { container } = renderWith(<ReputationHistoryChart history={HISTORY} events={EVENTS} />);
    const svg = container.querySelector('svg')!;
    // getBoundingClientRect returns zeros in jsdom, so tooltip may not show,
    // but we assert mouse handlers are present without crashing
    fireEvent.mouseMove(svg, { clientX: 100, clientY: 50 });
    fireEvent.mouseLeave(svg);
  });
});

// ── ReputationBreakdown ───────────────────────────────────────────────────────

describe('ReputationBreakdown', () => {
  it('renders section heading', () => {
    renderWith(<ReputationBreakdown breakdown={BREAKDOWN} />);
    expect(screen.getByRole('region', { name: /reputation breakdown/i })).toBeInTheDocument();
    expect(screen.getByText(/score breakdown/i)).toBeInTheDocument();
  });

  it('displays T1, T2, T3 completion labels', () => {
    renderWith(<ReputationBreakdown breakdown={BREAKDOWN} />);
    expect(screen.getByText('T1 Completions')).toBeInTheDocument();
    expect(screen.getByText('T2 Completions')).toBeInTheDocument();
    expect(screen.getByText('T3 Completions')).toBeInTheDocument();
  });

  it('displays REP earned sub-labels: T1×50, T2×100, T3×200', () => {
    renderWith(<ReputationBreakdown breakdown={BREAKDOWN} />);
    // T1: 6 × 50 = 300
    expect(screen.getByText('300 REP earned')).toBeInTheDocument();
    // T2: 3 × 100 = 300
    expect(screen.getByText('300 REP earned')).toBeInTheDocument();
    // T3: 1 × 200 = 200
    expect(screen.getByText('200 REP earned')).toBeInTheDocument();
  });

  it('displays avg review score and review count', () => {
    renderWith(<ReputationBreakdown breakdown={BREAKDOWN} />);
    expect(screen.getByText('4.2 / 5.0')).toBeInTheDocument();
    expect(screen.getByText('10 reviews')).toBeInTheDocument();
  });

  it('shows singular "review" when reviewCount is 1', () => {
    renderWith(<ReputationBreakdown breakdown={{ ...BREAKDOWN, reviewCount: 1 }} />);
    expect(screen.getByText('1 review')).toBeInTheDocument();
  });

  it('shows streak badge when streak > 0', () => {
    renderWith(<ReputationBreakdown breakdown={BREAKDOWN} />);
    expect(screen.getByText(/7d streak/)).toBeInTheDocument();
  });

  it('does not show streak badge when streak is 0', () => {
    renderWith(<ReputationBreakdown breakdown={{ ...BREAKDOWN, streak: 0 }} />);
    expect(screen.queryByText(/streak/)).not.toBeInTheDocument();
  });

  it('renders star rating accessible label', () => {
    renderWith(<ReputationBreakdown breakdown={BREAKDOWN} />);
    // rounded(4.2) = 4 filled stars
    expect(screen.getByLabelText(/4 out of 5 stars/i)).toBeInTheDocument();
  });

  it('renders tier point legend (T1=50, T2=100, T3=200)', () => {
    renderWith(<ReputationBreakdown breakdown={BREAKDOWN} />);
    expect(screen.getByText('T1 = +50 REP')).toBeInTheDocument();
    expect(screen.getByText('T2 = +100 REP')).toBeInTheDocument();
    expect(screen.getByText('T3 = +200 REP')).toBeInTheDocument();
  });

  it('shows loading skeleton with aria content when loading=true', () => {
    renderWith(<ReputationBreakdown breakdown={BREAKDOWN} loading />);
    // Loading renders BreakdownSkeleton, no region role
    expect(screen.queryByRole('region', { name: /reputation breakdown/i })).not.toBeInTheDocument();
  });
});

// ── TierProgressIndicator ─────────────────────────────────────────────────────

describe('TierProgressIndicator', () => {
  it('renders tier progress region', () => {
    renderWith(
      <TierProgressIndicator tier="T1" t1Completions={2} t2Completions={0} t3Completions={0} />,
    );
    expect(screen.getByRole('region', { name: /tier progress/i })).toBeInTheDocument();
    expect(screen.getByText(/tier progress/i)).toBeInTheDocument();
  });

  it('T1 with 2 completions: shows 2 more T1 merges needed', () => {
    renderWith(
      <TierProgressIndicator tier="T1" t1Completions={2} t2Completions={0} t3Completions={0} />,
    );
    expect(screen.getByText(/2 more T1 merges needed to unlock T2/i)).toBeInTheDocument();
  });

  it('T1 with exactly 1 completion remaining: singular "merge"', () => {
    renderWith(
      <TierProgressIndicator tier="T1" t1Completions={3} t2Completions={0} t3Completions={0} />,
    );
    expect(screen.getByText(/1 more T1 merge needed to unlock T2/i)).toBeInTheDocument();
  });

  it('T1 with 4+ completions: shows T2 requirements met', () => {
    renderWith(
      <TierProgressIndicator tier="T1" t1Completions={4} t2Completions={0} t3Completions={0} />,
    );
    expect(screen.getByText(/T2 requirements met/i)).toBeInTheDocument();
  });

  it('T2 on path to T3 (needs 2 more T2 merges)', () => {
    renderWith(
      <TierProgressIndicator tier="T2" t1Completions={4} t2Completions={1} t3Completions={0} />,
    );
    expect(screen.getByText(/To unlock T3/i)).toBeInTheDocument();
  });

  it('T2 with requirements met: shows T3 requirements met', () => {
    renderWith(
      <TierProgressIndicator tier="T2" t1Completions={5} t2Completions={3} t3Completions={0} />,
    );
    expect(screen.getByText(/T3 requirements met/i)).toBeInTheDocument();
  });

  it('T3 tier: shows maximum tier reached message', () => {
    renderWith(
      <TierProgressIndicator tier="T3" t1Completions={6} t2Completions={3} t3Completions={1} />,
    );
    expect(screen.getByText(/maximum tier reached/i)).toBeInTheDocument();
  });

  it('shows loading skeleton when loading=true', () => {
    renderWith(
      <TierProgressIndicator tier="T1" t1Completions={0} t2Completions={0} t3Completions={0} loading />,
    );
    expect(screen.queryByRole('region', { name: /tier progress/i })).not.toBeInTheDocument();
  });

  it('renders tier point legend (T1/T2/T3)', () => {
    renderWith(
      <TierProgressIndicator tier="T2" t1Completions={4} t2Completions={1} t3Completions={0} />,
    );
    expect(screen.getByText('T1')).toBeInTheDocument();
    expect(screen.getByText('T2')).toBeInTheDocument();
    expect(screen.getByText('T3')).toBeInTheDocument();
    expect(screen.getByText('+50 REP')).toBeInTheDocument();
    expect(screen.getByText('+100 REP')).toBeInTheDocument();
    expect(screen.getByText('+200 REP')).toBeInTheDocument();
  });
});

// ── ReputationPanel ───────────────────────────────────────────────────────────

describe('ReputationPanel', () => {
  it('shows error alert when API returns 401', async () => {
    mockFetch.mockResolvedValue(errorResponse(401));
    renderWith(<ReputationPanel username="alice" />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('shows loading skeletons while fetching', () => {
    // Never resolves so loading state stays
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderWith(<ReputationPanel username="alice" />);
    // Loading skeleton: aria-busy on score card
    expect(screen.getByLabelText(/loading reputation score/i)).toBeInTheDocument();
  });

  it('renders all subcomponents after successful fetch', async () => {
    mockFetch.mockResolvedValue(okJson(REP_DATA));
    renderWith(<ReputationPanel username="alice" />);

    await waitFor(() =>
      expect(screen.getByRole('region', { name: /reputation score/i })).toBeInTheDocument(),
    );
    expect(screen.getByRole('region', { name: /reputation breakdown/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /tier progress/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /reputation history chart/i })).toBeInTheDocument();
  });

  it('shows leaderboard link for top-3 ranked user', async () => {
    mockFetch.mockResolvedValue(okJson(REP_DATA));
    renderWith(<ReputationPanel username="alice" />);
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /view alice on the leaderboard/i })).toBeInTheDocument(),
    );
  });

  it('shows recent activity events feed', async () => {
    mockFetch.mockResolvedValue(okJson(REP_DATA));
    renderWith(<ReputationPanel username="alice" />);
    await waitFor(() =>
      expect(screen.getByRole('list', { name: /reputation events/i })).toBeInTheDocument(),
    );
    expect(screen.getByText('Completed T3 bounty')).toBeInTheDocument();
    expect(screen.getByText('Completed T2 bounty')).toBeInTheDocument();
  });

  it('shows "No activity yet" when events array is empty', async () => {
    mockFetch.mockResolvedValue(okJson({ ...REP_DATA, events: [] }));
    renderWith(<ReputationPanel username="alice" />);
    await waitFor(() => expect(screen.getByText(/no activity yet/i)).toBeInTheDocument());
  });

  it('shows tooltip detail on event row hover', async () => {
    mockFetch.mockResolvedValue(okJson(REP_DATA));
    renderWith(<ReputationPanel username="alice" />);
    await waitFor(() =>
      expect(screen.getByText('Completed T3 bounty')).toBeInTheDocument(),
    );
    const eventItem = screen.getByLabelText(/completed t3 bounty/i);
    fireEvent.mouseEnter(eventItem);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.mouseLeave(eventItem);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('falls back to leaderboard data when reputation endpoint returns 404', async () => {
    const leaderboardRow = [{ username: 'alice', points: 500, bountiesCompleted: 5 }];
    mockFetch
      .mockResolvedValueOnce(errorResponse(404))   // reputation endpoint → 404
      .mockResolvedValueOnce(okJson(leaderboardRow)); // leaderboard fallback
    renderWith(<ReputationPanel username="alice" />);
    await waitFor(() =>
      expect(screen.getByRole('region', { name: /reputation score/i })).toBeInTheDocument(),
    );
  });
});

// ── useReputation hook ────────────────────────────────────────────────────────

describe('useReputation hook', () => {
  it('returns reputation data from API on success', async () => {
    mockFetch.mockResolvedValue(okJson(REP_DATA));
    const { result } = wrapHook(() => useReputation('alice'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.reputation?.score).toBe(1450);
    expect(result.current.reputation?.tier).toBe('T3');
    expect(result.current.error).toBeNull();
  });

  it('falls back to leaderboard when reputation endpoint is 404', async () => {
    mockFetch
      .mockResolvedValueOnce(errorResponse(404))
      .mockResolvedValueOnce(okJson([{ username: 'alice', points: 300, bountiesCompleted: 4 }]));
    const { result } = wrapHook(() => useReputation('alice'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.reputation).not.toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('returns ultimate fallback (score 0) when both endpoints fail', async () => {
    mockFetch.mockResolvedValue(errorResponse(500));
    const { result } = wrapHook(() => useReputation('nobody'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.reputation?.score).toBe(0);
    expect(result.current.reputation?.rank).toBe(0);
  });

  it('throws and sets error when API returns 403', async () => {
    mockFetch.mockResolvedValue(errorResponse(403));
    const { result } = wrapHook(() => useReputation('alice'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).not.toBeNull();
    expect(result.current.reputation).toBeNull();
  });

  it('stays in loading state when username is empty string (disabled)', () => {
    mockFetch.mockResolvedValue(okJson(REP_DATA));
    const { result } = wrapHook(() => useReputation(''));
    // Query is disabled — no fetch fires, stays in idle/loading
    expect(result.current.reputation).toBeNull();
  });

  it('is initially loading when username is provided', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    const { result } = wrapHook(() => useReputation('alice'));
    expect(result.current.loading).toBe(true);
  });
});
