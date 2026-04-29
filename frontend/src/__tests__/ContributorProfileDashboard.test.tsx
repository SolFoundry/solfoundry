import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ContributorProfileDashboard } from '../components/profile/ContributorProfileDashboard';
import { ActivityGraph } from '../components/profile/ActivityGraph';
import { EarningsChart } from '../components/profile/EarningsChart';
import { StatCard } from '../components/profile/StatCard';
import { useContributorStats } from '../components/profile/useContributorStats';

vi.mock('../components/profile/useContributorStats', () => ({
  useContributorStats: vi.fn(),
}));

const mockStats = {
  username: 'testuser',
  avatarUrl: 'https://example.com/avatar.png',
  totalEarned: 2500000,
  bountiesCompleted: 15,
  contributionStreak: 12,
  githubStats: {
    commits: 234,
    pullRequests: 45,
    issues: 23,
    reviews: 67,
  },
  earningsHistory: [
    { date: '2026-04-25', amount: 500000, bountyTitle: 'Bounty #1', bountyNumber: 1 },
    { date: '2026-04-20', amount: 300000, bountyTitle: 'Bounty #2', bountyNumber: 2 },
    { date: '2026-04-15', amount: 400000, bountyTitle: 'Bounty #3', bountyNumber: 3 },
  ],
  activityData: Array.from({ length: 90 }, (_, i) => ({
    date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
    count: Math.floor(Math.random() * 5),
    level: Math.floor(Math.random() * 5) as 0 | 1 | 2 | 3 | 4,
  })),
  rank: 5,
  totalContributors: 500,
};

describe('ContributorProfileDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state', () => {
    (useContributorStats as ReturnType<typeof vi.fn>).mockReturnValue({
      data: null,
      loading: true,
      error: null,
      refresh: vi.fn(),
    });

    render(<ContributorProfileDashboard username="testuser" />);

    // During loading, stat cards show "..." as placeholder
    const statValues = screen.getAllByText('...');
    expect(statValues.length).toBeGreaterThan(0);
  });

  it('displays profile data when loaded', () => {
    (useContributorStats as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockStats,
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<ContributorProfileDashboard username="testuser" />);

    expect(screen.getByText('testuser')).toBeInTheDocument();
    expect(screen.getByText('Rank #5 of 500')).toBeInTheDocument();
  });

  it('displays key stats', () => {
    (useContributorStats as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockStats,
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<ContributorProfileDashboard username="testuser" />);

    expect(screen.getByText('Total Earned')).toBeInTheDocument();
    expect(screen.getByText('Bounties Completed')).toBeInTheDocument();
    expect(screen.getByText('Contribution Streak')).toBeInTheDocument();
  });

  it('displays GitHub activity stats', () => {
    (useContributorStats as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockStats,
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<ContributorProfileDashboard username="testuser" />);

    expect(screen.getByText('Commits')).toBeInTheDocument();
    expect(screen.getByText('Pull Requests')).toBeInTheDocument();
    expect(screen.getByText('Issues')).toBeInTheDocument();
    expect(screen.getByText('Reviews')).toBeInTheDocument();
  });

  it('displays earnings history', () => {
    (useContributorStats as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockStats,
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<ContributorProfileDashboard username="testuser" />);

    expect(screen.getByText('Earnings History')).toBeInTheDocument();
    expect(screen.getByText('Bounty #1')).toBeInTheDocument();
  });

  it('shows error state when fetch fails', () => {
    (useContributorStats as ReturnType<typeof vi.fn>).mockReturnValue({
      data: null,
      loading: false,
      error: 'API error',
      refresh: vi.fn(),
    });

    render(<ContributorProfileDashboard username="testuser" />);

    expect(
      screen.getByText(/Failed to load profile data/)
    ).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });
});

describe('ActivityGraph', () => {
  const mockActivityData = Array.from({ length: 90 }, (_, i) => ({
    date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
    count: Math.floor(Math.random() * 5),
    level: Math.floor(Math.random() * 5) as 0 | 1 | 2 | 3 | 4,
  }));

  it('renders SVG with activity cells', () => {
    const { container } = render(
      <ActivityGraph data={mockActivityData} width={500} height={120} />
    );

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();

    const cells = container.querySelectorAll('rect');
    expect(cells.length).toBeGreaterThan(0);
  });

  it('renders legend', () => {
    const { container } = render(
      <ActivityGraph data={mockActivityData} />
    );

    expect(container.querySelector('.activity-graph__legend')).toBeInTheDocument();
  });

  it('handles empty data', () => {
    const { container } = render(<ActivityGraph data={[]} />);

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});

describe('EarningsChart', () => {
  const mockEarnings = [
    { date: '2026-04-01', amount: 100000 },
    { date: '2026-04-05', amount: 200000 },
    { date: '2026-04-10', amount: 150000 },
    { date: '2026-04-15', amount: 300000 },
    { date: '2026-04-20', amount: 250000 },
  ];

  it('renders bars for earnings data', () => {
    const { container } = render(
      <EarningsChart data={mockEarnings} width={400} height={200} />
    );

    const bars = container.querySelectorAll('rect');
    expect(bars.length).toBeGreaterThan(0);
  });

  it('shows empty state for no data', () => {
    const { container } = render(<EarningsChart data={[]} />);

    expect(container.querySelector('.earnings-chart--empty')).toBeInTheDocument();
  });
});

describe('StatCard', () => {
  it('renders label and value', () => {
    const { container } = render(
      <StatCard label="Test Label" value={42} />
    );

    expect(screen.getByText('Test Label')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders with icon', () => {
    const { container } = render(
      <StatCard label="Test" value={100} icon="💰" />
    );

    expect(screen.getByText('💰')).toBeInTheDocument();
  });

  it('renders trend indicator', () => {
    const { container } = render(
      <StatCard label="Test" value={100} trend="up" trendValue="+10%" />
    );

    expect(screen.getByText(/↑/)).toBeInTheDocument();
    expect(screen.getByText(/10%/)).toBeInTheDocument();
  });
});
