import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContributorProfile } from './ContributorProfile';
import type { ContributorBadgeStats } from '../types/badges';

const badgeStats: ContributorBadgeStats = {
  mergedPrCount: 3,
  mergedWithoutRevisionCount: 1,
  isTopContributorThisMonth: false,
  prSubmissionTimestampsUtc: ['2026-03-15T14:00:00Z'],
};

describe('ContributorProfile', () => {
  const defaultProps = {
    username: 'testuser',
    avatarUrl: 'https://example.com/avatar.png',
    walletAddress: 'Amu1YJjcKWKL6xuMTo2dx511kfzXAjxgpetJrZp7N71o7',
    totalEarned: 10000,
    bountiesCompleted: 5,
    reputationScore: 100,
  };

  it('renders username correctly', () => {
    render(<ContributorProfile {...defaultProps} />);
    expect(screen.getByText('testuser')).toBeInTheDocument();
  });

  it('displays truncated wallet address (first 4 + last 4)', () => {
    render(<ContributorProfile {...defaultProps} />);
    expect(screen.getByText('Amu1...o7')).toBeInTheDocument();
  });

  it('displays total earned', () => {
    render(<ContributorProfile {...defaultProps} />);
    expect(screen.getByText(/10,000 FNDRY/)).toBeInTheDocument();
  });

  it('displays bounties completed', () => {
    render(<ContributorProfile {...defaultProps} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('displays reputation score', () => {
    render(<ContributorProfile {...defaultProps} />);
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('disables hire button with placeholder text', () => {
    render(<ContributorProfile {...defaultProps} />);
    const button = screen.getByRole('button', { name: /Hire as Agent/ });
    expect(button).toBeDisabled();
  });

  it('handles missing avatar with initial', () => {
    render(<ContributorProfile {...defaultProps} avatarUrl={undefined} />);
    expect(screen.getByText('T')).toBeInTheDocument();
  });

  it('handles missing wallet address', () => {
    render(<ContributorProfile {...defaultProps} walletAddress="" />);
    expect(screen.getByText('Not connected')).toBeInTheDocument();
  });

  it('shows badge count when badgeStats provided', () => {
    render(<ContributorProfile {...defaultProps} badgeStats={badgeStats} />);
    expect(screen.getByTestId('header-badge-count')).toBeInTheDocument();
    expect(screen.getByTestId('badge-grid')).toBeInTheDocument();
  });

  it('hides badge section when badgeStats not provided', () => {
    render(<ContributorProfile {...defaultProps} />);
    expect(screen.queryByTestId('badge-grid')).not.toBeInTheDocument();
    expect(screen.queryByTestId('header-badge-count')).not.toBeInTheDocument();
  });

  it('renders tier progress bar section', () => {
    render(<ContributorProfile {...defaultProps} completedT1={2} completedT2={0} completedT3={0} />);
    expect(screen.getByTestId('tier-progress-section')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders T1/T2/T3 breakdown in stats', () => {
    render(
      <ContributorProfile
        {...defaultProps}
        completedT1={3}
        completedT2={1}
        completedT3={0}
      />,
    );
    const breakdown = screen.getByTestId('bounty-tier-breakdown');
    expect(breakdown).toBeInTheDocument();
    expect(breakdown).toHaveTextContent('T1:');
    expect(breakdown).toHaveTextContent('T2:');
    expect(breakdown).toHaveTextContent('T3:');
  });

  it('shows copy button for wallet address', () => {
    render(<ContributorProfile {...defaultProps} />);
    expect(screen.getByTestId('copy-wallet-btn')).toBeInTheDocument();
  });

  it('copy button copies the full wallet address to clipboard', async () => {
    const user = userEvent.setup();
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
    });
    render(<ContributorProfile {...defaultProps} />);
    await user.click(screen.getByTestId('copy-wallet-btn'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'Amu1YJjcKWKL6xuMTo2dx511kfzXAjxgpetJrZp7N71o7',
    );
  });

  it('renders join date when provided', () => {
    render(<ContributorProfile {...defaultProps} joinDate="2025-06-01T00:00:00Z" />);
    expect(screen.getByText(/Joined/)).toBeInTheDocument();
  });

  it('renders recent activity section', () => {
    const recentBounties = [
      { id: 'b1', title: 'Fix login bug', tier: 'T1' as const, reward: 5000, completedAt: '2026-03-01T00:00:00Z' },
    ];
    render(<ContributorProfile {...defaultProps} recentBounties={recentBounties} />);
    expect(screen.getByTestId('recent-activity-section')).toBeInTheDocument();
    expect(screen.getByTestId('recent-activity-list')).toBeInTheDocument();
    expect(screen.getByText('Fix login bug')).toBeInTheDocument();
  });

  it('renders empty activity message when no recent bounties', () => {
    render(<ContributorProfile {...defaultProps} recentBounties={[]} />);
    expect(screen.getByText(/No completed bounties yet/)).toBeInTheDocument();
  });
});
