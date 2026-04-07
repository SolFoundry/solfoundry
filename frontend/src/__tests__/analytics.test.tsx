/**
 * Analytics test suite.
 *
 * Tests for the Contributor Analytics Platform frontend components:
 * - AnalyticsLeaderboardPage: Leaderboard with filtering and sorting
 * - ContributorAnalyticsPage: Detailed contributor profiles
 * - BountyAnalyticsPage: Bounty statistics by tier/category
 * - PlatformHealthPage: Platform metrics and growth
 * - MetricCard: Reusable stat card
 *
 * All tests mock the fetch API and wrap components in QueryClientProvider.
 * @module __tests__/analytics
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Components under test
import { AnalyticsLeaderboardPage } from '../components/analytics/AnalyticsLeaderboardPage';
import { BountyAnalyticsPage } from '../components/analytics/BountyAnalyticsPage';
import { PlatformHealthPage } from '../components/analytics/PlatformHealthPage';
import { ContributorAnalyticsPage } from '../components/analytics/ContributorAnalyticsPage';
import { MetricCard } from '../components/analytics/MetricCard';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock ResizeObserver for Recharts
vi.stubGlobal('ResizeObserver', class {
  observe() {}
  unobserve() {}
  disconnect() {}
});

beforeEach(() => mockFetch.mockReset());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Successful JSON response helper. */
function okJson(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(data),
    headers: new Headers({ 'content-type': 'application/json' }),
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

/** Error response helper. */
function errorJson(status: number, message: string): Response {
  return {
    ok: false,
    status,
    statusText: 'Error',
    json: () => Promise.resolve({ message, code: `HTTP_${status}` }),
    headers: new Headers({ 'content-type': 'application/json' }),
    redirected: false,
    type: 'basic' as ResponseType,
    url: '',
    clone: function () { return this; },
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(JSON.stringify({ message })),
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

/** Wrap component in QueryClientProvider + MemoryRouter with routes. */
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
// Mock data
// ---------------------------------------------------------------------------

const MOCK_LEADERBOARD_RESPONSE = {
  entries: [
    {
      rank: 1,
      username: 'alice_dev',
      display_name: 'Alice Dev',
      avatar_url: 'https://github.com/alice.png',
      tier: 2,
      total_earned: 5000.0,
      bounties_completed: 12,
      quality_score: 8.5,
      reputation_score: 85.0,
      on_chain_verified: true,
      wallet_address: '97VihHW2...',
      top_skills: ['Python', 'React'],
      streak_days: 7,
    },
    {
      rank: 2,
      username: 'bob_builder',
      display_name: 'Bob Builder',
      avatar_url: 'https://github.com/bob.png',
      tier: 1,
      total_earned: 2000.0,
      bounties_completed: 5,
      quality_score: 7.2,
      reputation_score: 60.0,
      on_chain_verified: false,
      wallet_address: null,
      top_skills: ['TypeScript'],
      streak_days: 3,
    },
  ],
  total: 2,
  page: 1,
  per_page: 20,
  sort_by: 'total_earned',
  sort_order: 'desc',
  filters_applied: {},
};

const MOCK_CONTRIBUTOR_PROFILE = {
  username: 'alice_dev',
  display_name: 'Alice Dev',
  avatar_url: 'https://github.com/alice.png',
  bio: 'Full-stack developer focused on Solana',
  wallet_address: '97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF',
  tier: 2,
  total_earned: 5000.0,
  bounties_completed: 12,
  quality_score: 8.5,
  reputation_score: 85.0,
  on_chain_verified: true,
  top_skills: ['Python', 'React', 'FastAPI'],
  badges: ['tier-2', 'early-adopter'],
  completion_history: [
    {
      bounty_id: 'b1',
      bounty_title: 'Implement Auth',
      tier: 1,
      category: 'backend',
      reward_amount: 150000,
      review_score: 8.2,
      completed_at: '2026-03-01T12:00:00Z',
      time_to_complete_hours: 24.5,
      on_chain_tx_hash: 'abc123def456',
    },
  ],
  tier_progression: [
    { tier: 1, achieved_at: null, qualifying_bounties: 4, average_score_at_achievement: 7.5 },
    { tier: 2, achieved_at: null, qualifying_bounties: 8, average_score_at_achievement: 8.0 },
  ],
  review_score_trend: [
    { date: '2026-02-01', score: 7.0, bounty_title: 'Fix Bug', bounty_tier: 1 },
    { date: '2026-03-01', score: 8.2, bounty_title: 'Implement Auth', bounty_tier: 1 },
  ],
  joined_at: '2025-12-01T00:00:00Z',
  last_active_at: '2026-03-20T00:00:00Z',
  streak_days: 7,
  completions_by_tier: { 'tier-1': 8, 'tier-2': 4 },
  completions_by_category: { backend: 7, frontend: 5 },
};

const MOCK_BOUNTY_ANALYTICS = {
  by_tier: [
    { tier: 1, total_bounties: 100, completed: 60, in_progress: 20, open: 20, completion_rate: 60.0, average_review_score: 7.5, average_time_to_complete_hours: 48, total_reward_paid: 9000000 },
    { tier: 2, total_bounties: 50, completed: 20, in_progress: 15, open: 15, completion_rate: 40.0, average_review_score: 8.0, average_time_to_complete_hours: 72, total_reward_paid: 10000000 },
    { tier: 3, total_bounties: 20, completed: 5, in_progress: 10, open: 5, completion_rate: 25.0, average_review_score: 8.5, average_time_to_complete_hours: 120, total_reward_paid: 5000000 },
  ],
  by_category: [
    { category: 'backend', total_bounties: 80, completed: 40, completion_rate: 50.0, average_review_score: 7.8, total_reward_paid: 12000000 },
    { category: 'frontend', total_bounties: 60, completed: 30, completion_rate: 50.0, average_review_score: 7.5, total_reward_paid: 8000000 },
  ],
  overall_completion_rate: 50.0,
  overall_average_review_score: 7.8,
  total_bounties: 170,
  total_completed: 85,
  total_reward_paid: 24000000,
};

const MOCK_PLATFORM_HEALTH = {
  total_contributors: 150,
  active_contributors: 45,
  total_bounties: 170,
  open_bounties: 40,
  in_progress_bounties: 45,
  completed_bounties: 85,
  total_fndry_paid: 24000000,
  total_prs_reviewed: 320,
  average_review_score: 7.8,
  bounties_by_status: { open: 40, in_progress: 45, completed: 85 },
  growth_trend: [
    { date: '2026-03-20', bounties_created: 5, bounties_completed: 3, new_contributors: 2, fndry_paid: 500000 },
    { date: '2026-03-21', bounties_created: 3, bounties_completed: 2, new_contributors: 1, fndry_paid: 300000 },
    { date: '2026-03-22', bounties_created: 4, bounties_completed: 4, new_contributors: 0, fndry_paid: 600000 },
  ],
  top_categories: [
    { category: 'backend', total_bounties: 80, completed: 40, completion_rate: 50.0, average_review_score: 7.8, total_reward_paid: 12000000 },
  ],
};

// ---------------------------------------------------------------------------
// MetricCard tests
// ---------------------------------------------------------------------------

describe('MetricCard', () => {
  it('renders label and value', () => {
    renderWithProviders(<MetricCard label="Total Earned" value={5000} testId="metric" />);
    expect(screen.getByTestId('metric')).toBeInTheDocument();
    expect(screen.getByText('Total Earned')).toBeInTheDocument();
    expect(screen.getByText('5,000')).toBeInTheDocument();
  });

  it('renders change indicator when provided', () => {
    renderWithProviders(
      <MetricCard label="Score" value="8.5" change="+0.5" changePositive testId="metric" />,
    );
    expect(screen.getByText('+0.5')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    renderWithProviders(<MetricCard label="Test" value={0} icon="\uD83C\uDFAF" testId="metric" />);
    expect(screen.getByTestId('metric')).toBeInTheDocument();
  });

  it('formats numeric values with locale string', () => {
    renderWithProviders(<MetricCard label="Big Number" value={1234567} testId="metric" />);
    expect(screen.getByText('1,234,567')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AnalyticsLeaderboardPage tests
// ---------------------------------------------------------------------------

describe('AnalyticsLeaderboardPage', () => {
  it('renders page heading after data loads', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_LEADERBOARD_RESPONSE));
    renderWithProviders(<AnalyticsLeaderboardPage />);
    await waitFor(() =>
      expect(screen.getByTestId('analytics-leaderboard-page')).toBeInTheDocument(),
    );
  });

  it('renders leaderboard data after fetch', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_LEADERBOARD_RESPONSE));
    renderWithProviders(<AnalyticsLeaderboardPage />);
    await waitFor(() => expect(screen.getByText('alice_dev')).toBeInTheDocument());
    expect(screen.getByText('bob_builder')).toBeInTheDocument();
  });

  it('shows quality scores for contributors', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_LEADERBOARD_RESPONSE));
    renderWithProviders(<AnalyticsLeaderboardPage />);
    await waitFor(() => expect(screen.getByText('8.5')).toBeInTheDocument());
    expect(screen.getByText('7.2')).toBeInTheDocument();
  });

  it('shows tier badges for contributors', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_LEADERBOARD_RESPONSE));
    renderWithProviders(<AnalyticsLeaderboardPage />);
    await waitFor(() => expect(screen.getByText('T2')).toBeInTheDocument());
    expect(screen.getByText('T1')).toBeInTheDocument();
  });

  it('renders search input', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_LEADERBOARD_RESPONSE));
    renderWithProviders(<AnalyticsLeaderboardPage />);
    await waitFor(() => expect(screen.getByText('alice_dev')).toBeInTheDocument());
    const searchInput = screen.getByRole('searchbox', { name: /search/i });
    expect(searchInput).toBeInTheDocument();
  });

  it('renders time range buttons', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_LEADERBOARD_RESPONSE));
    renderWithProviders(<AnalyticsLeaderboardPage />);
    await waitFor(() => expect(screen.getByText('alice_dev')).toBeInTheDocument());
    expect(screen.getByText('7 days')).toBeInTheDocument();
    expect(screen.getByText('All time')).toBeInTheDocument();
  });

  it('renders page heading', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_LEADERBOARD_RESPONSE));
    renderWithProviders(<AnalyticsLeaderboardPage />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /contributor leaderboard/i })).toBeInTheDocument(),
    );
  });

  it('shows error state on fetch failure', async () => {
    mockFetch.mockResolvedValue(errorJson(400, 'Bad Request'));
    renderWithProviders(<AnalyticsLeaderboardPage />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('shows results count', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_LEADERBOARD_RESPONSE));
    renderWithProviders(<AnalyticsLeaderboardPage />);
    await waitFor(() => expect(screen.getByText(/showing 2 of 2 contributors/i)).toBeInTheDocument());
  });
});

// ---------------------------------------------------------------------------
// ContributorAnalyticsPage tests
// ---------------------------------------------------------------------------

describe('ContributorAnalyticsPage', () => {
  it('renders page wrapper after data loads', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_CONTRIBUTOR_PROFILE));
    renderWithRouter(
      <Routes>
        <Route path="/analytics/contributors/:username" element={<ContributorAnalyticsPage />} />
      </Routes>,
      ['/analytics/contributors/alice_dev'],
    );
    await waitFor(() =>
      expect(screen.getByTestId('contributor-analytics-page')).toBeInTheDocument(),
    );
  });

  it('renders contributor profile data', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_CONTRIBUTOR_PROFILE));
    renderWithRouter(
      <Routes>
        <Route path="/analytics/contributors/:username" element={<ContributorAnalyticsPage />} />
      </Routes>,
      ['/analytics/contributors/alice_dev'],
    );
    await waitFor(() => expect(screen.getByText('Alice Dev')).toBeInTheDocument());
    expect(screen.getByText('@alice_dev')).toBeInTheDocument();
  });

  it('shows tier badge in header', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_CONTRIBUTOR_PROFILE));
    renderWithRouter(
      <Routes>
        <Route path="/analytics/contributors/:username" element={<ContributorAnalyticsPage />} />
      </Routes>,
      ['/analytics/contributors/alice_dev'],
    );
    await waitFor(() => {
      const badges = screen.getAllByText(/Tier 2/);
      expect(badges.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows on-chain verification badge', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_CONTRIBUTOR_PROFILE));
    renderWithRouter(
      <Routes>
        <Route path="/analytics/contributors/:username" element={<ContributorAnalyticsPage />} />
      </Routes>,
      ['/analytics/contributors/alice_dev'],
    );
    await waitFor(() => expect(screen.getByText('On-chain Verified')).toBeInTheDocument());
  });

  it('shows skill badges', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_CONTRIBUTOR_PROFILE));
    renderWithRouter(
      <Routes>
        <Route path="/analytics/contributors/:username" element={<ContributorAnalyticsPage />} />
      </Routes>,
      ['/analytics/contributors/alice_dev'],
    );
    await waitFor(() => expect(screen.getByText('Python')).toBeInTheDocument());
    expect(screen.getByText('React')).toBeInTheDocument();
  });

  it('shows metric cards', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_CONTRIBUTOR_PROFILE));
    renderWithRouter(
      <Routes>
        <Route path="/analytics/contributors/:username" element={<ContributorAnalyticsPage />} />
      </Routes>,
      ['/analytics/contributors/alice_dev'],
    );
    await waitFor(() => expect(screen.getByTestId('metric-total-earned')).toBeInTheDocument());
    expect(screen.getByTestId('metric-bounties-done')).toBeInTheDocument();
    expect(screen.getByTestId('metric-quality-score')).toBeInTheDocument();
  });

  it('shows completion history table', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_CONTRIBUTOR_PROFILE));
    renderWithRouter(
      <Routes>
        <Route path="/analytics/contributors/:username" element={<ContributorAnalyticsPage />} />
      </Routes>,
      ['/analytics/contributors/alice_dev'],
    );
    await waitFor(() => expect(screen.getByText('Implement Auth')).toBeInTheDocument());
  });

  it('shows error state on 404', async () => {
    mockFetch.mockResolvedValue(errorJson(404, 'Contributor not found'));
    renderWithRouter(
      <Routes>
        <Route path="/analytics/contributors/:username" element={<ContributorAnalyticsPage />} />
      </Routes>,
      ['/analytics/contributors/nonexistent'],
    );
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('shows badges section', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_CONTRIBUTOR_PROFILE));
    renderWithRouter(
      <Routes>
        <Route path="/analytics/contributors/:username" element={<ContributorAnalyticsPage />} />
      </Routes>,
      ['/analytics/contributors/alice_dev'],
    );
    await waitFor(() => expect(screen.getByText('tier-2')).toBeInTheDocument());
    expect(screen.getByText('early-adopter')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// BountyAnalyticsPage tests
// ---------------------------------------------------------------------------

describe('BountyAnalyticsPage', () => {
  it('renders page wrapper after data loads', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_BOUNTY_ANALYTICS));
    renderWithProviders(<BountyAnalyticsPage />);
    await waitFor(() =>
      expect(screen.getByTestId('bounty-analytics-page')).toBeInTheDocument(),
    );
  });

  it('renders bounty analytics data', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_BOUNTY_ANALYTICS));
    renderWithProviders(<BountyAnalyticsPage />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /bounty analytics/i })).toBeInTheDocument(),
    );
  });

  it('shows metric cards', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_BOUNTY_ANALYTICS));
    renderWithProviders(<BountyAnalyticsPage />);
    await waitFor(() => expect(screen.getByTestId('metric-total-bounties')).toBeInTheDocument());
    expect(screen.getByTestId('metric-completed')).toBeInTheDocument();
    expect(screen.getByTestId('metric-completion-rate')).toBeInTheDocument();
  });

  it('shows tier statistics table', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_BOUNTY_ANALYTICS));
    renderWithProviders(<BountyAnalyticsPage />);
    await waitFor(() =>
      expect(screen.getByRole('table', { name: /tier statistics/i })).toBeInTheDocument(),
    );
  });

  it('shows category statistics table', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_BOUNTY_ANALYTICS));
    renderWithProviders(<BountyAnalyticsPage />);
    await waitFor(() =>
      expect(screen.getByRole('table', { name: /category statistics/i })).toBeInTheDocument(),
    );
  });

  it('renders time range buttons', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_BOUNTY_ANALYTICS));
    renderWithProviders(<BountyAnalyticsPage />);
    await waitFor(() => expect(screen.getByText('7 days')).toBeInTheDocument());
    expect(screen.getByText('All time')).toBeInTheDocument();
  });

  it('shows error state on failure', async () => {
    mockFetch.mockResolvedValue(errorJson(400, 'Bad request'));
    renderWithProviders(<BountyAnalyticsPage />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });
});

// ---------------------------------------------------------------------------
// PlatformHealthPage tests
// ---------------------------------------------------------------------------

describe('PlatformHealthPage', () => {
  it('renders page wrapper after data loads', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_PLATFORM_HEALTH));
    renderWithProviders(<PlatformHealthPage />);
    await waitFor(() =>
      expect(screen.getByTestId('platform-health-page')).toBeInTheDocument(),
    );
  });

  it('renders platform health data', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_PLATFORM_HEALTH));
    renderWithProviders(<PlatformHealthPage />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /platform health/i })).toBeInTheDocument(),
    );
  });

  it('shows contributor metrics', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_PLATFORM_HEALTH));
    renderWithProviders(<PlatformHealthPage />);
    await waitFor(() => expect(screen.getByTestId('metric-contributors')).toBeInTheDocument());
  });

  it('shows bounty metrics', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_PLATFORM_HEALTH));
    renderWithProviders(<PlatformHealthPage />);
    await waitFor(() => expect(screen.getByTestId('metric-bounties')).toBeInTheDocument());
  });

  it('shows FNDRY paid metric', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_PLATFORM_HEALTH));
    renderWithProviders(<PlatformHealthPage />);
    await waitFor(() => expect(screen.getByTestId('metric-fndry-paid')).toBeInTheDocument());
  });

  it('renders time range buttons', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_PLATFORM_HEALTH));
    renderWithProviders(<PlatformHealthPage />);
    await waitFor(() => expect(screen.getByText('7 days')).toBeInTheDocument());
    expect(screen.getByText('30 days')).toBeInTheDocument();
  });

  it('shows bounties by status section', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_PLATFORM_HEALTH));
    renderWithProviders(<PlatformHealthPage />);
    await waitFor(() => expect(screen.getByText('Bounties by Status')).toBeInTheDocument());
  });

  it('shows top categories section', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_PLATFORM_HEALTH));
    renderWithProviders(<PlatformHealthPage />);
    await waitFor(() => expect(screen.getByText('Top Categories')).toBeInTheDocument());
  });

  it('shows error state on failure', async () => {
    mockFetch.mockResolvedValue(errorJson(400, 'Bad request'));
    renderWithProviders(<PlatformHealthPage />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });
});

// ---------------------------------------------------------------------------
// Route integration tests
// ---------------------------------------------------------------------------

describe('Analytics route integration', () => {
  it('renders leaderboard at /analytics/leaderboard', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_LEADERBOARD_RESPONSE));
    renderWithRouter(
      <Routes>
        <Route path="/analytics/leaderboard" element={<AnalyticsLeaderboardPage />} />
      </Routes>,
      ['/analytics/leaderboard'],
    );
    await waitFor(() =>
      expect(screen.getByTestId('analytics-leaderboard-page')).toBeInTheDocument(),
    );
  });

  it('renders bounty analytics at /analytics/bounties', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_BOUNTY_ANALYTICS));
    renderWithRouter(
      <Routes>
        <Route path="/analytics/bounties" element={<BountyAnalyticsPage />} />
      </Routes>,
      ['/analytics/bounties'],
    );
    await waitFor(() =>
      expect(screen.getByTestId('bounty-analytics-page')).toBeInTheDocument(),
    );
  });

  it('renders platform health at /analytics/platform', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_PLATFORM_HEALTH));
    renderWithRouter(
      <Routes>
        <Route path="/analytics/platform" element={<PlatformHealthPage />} />
      </Routes>,
      ['/analytics/platform'],
    );
    await waitFor(() =>
      expect(screen.getByTestId('platform-health-page')).toBeInTheDocument(),
    );
  });

  it('renders contributor profile at /analytics/contributors/:username', async () => {
    mockFetch.mockResolvedValue(okJson(MOCK_CONTRIBUTOR_PROFILE));
    renderWithRouter(
      <Routes>
        <Route path="/analytics/contributors/:username" element={<ContributorAnalyticsPage />} />
      </Routes>,
      ['/analytics/contributors/alice_dev'],
    );
    await waitFor(() =>
      expect(screen.getByTestId('contributor-analytics-page')).toBeInTheDocument(),
    );
  });
});
