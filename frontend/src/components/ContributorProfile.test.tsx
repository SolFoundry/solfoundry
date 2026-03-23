import { render, screen, fireEvent } from '@testing-library/react';
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

  it('displays truncated wallet address', () => {
    render(<ContributorProfile {...defaultProps} />);
    expect(screen.getByText(/Amu1YJ.*71o7/)).toBeInTheDocument();
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

  // ── Tier badge tests ────────────────────────────────────────────────────────

  it('renders tier 1 badge with bronze styling', () => {
    render(<ContributorProfile {...defaultProps} tier={1} />);
    const badge = screen.getByTestId('tier-badge');
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toContain('Tier 1');
    expect(badge.textContent).toContain('🥉');
  });

  it('renders tier 2 badge with silver styling', () => {
    render(<ContributorProfile {...defaultProps} tier={2} />);
    const badge = screen.getByTestId('tier-badge');
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toContain('Tier 2');
    expect(badge.textContent).toContain('🥈');
  });

  it('renders tier 3 badge with gold styling', () => {
    render(<ContributorProfile {...defaultProps} tier={3} />);
    const badge = screen.getByTestId('tier-badge');
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toContain('Tier 3');
    expect(badge.textContent).toContain('🥇');
  });

  it('does not show tier badge when tier is omitted', () => {
    render(<ContributorProfile {...defaultProps} />);
    expect(screen.queryByTestId('tier-badge')).not.toBeInTheDocument();
  });

  // ── T1/T2/T3 breakdown tests ───────────────────────────────────────────────

  it('shows T1/T2/T3 breakdown when bounties are completed', () => {
    render(
      <ContributorProfile {...defaultProps} t1Completed={3} t2Completed={1} t3Completed={0} />,
    );
    const breakdown = screen.getByTestId('tier-breakdown');
    expect(breakdown).toBeInTheDocument();
    expect(breakdown.textContent).toContain('3');
    expect(breakdown.textContent).toContain('1');
    expect(breakdown.textContent).toContain('T1');
    expect(breakdown.textContent).toContain('T2');
    expect(breakdown.textContent).toContain('T3');
  });

  it('hides T1/T2/T3 breakdown when all counts are zero', () => {
    render(
      <ContributorProfile {...defaultProps} t1Completed={0} t2Completed={0} t3Completed={0} />,
    );
    expect(screen.queryByTestId('tier-breakdown')).not.toBeInTheDocument();
  });

  // ── Tier progress bar tests ─────────────────────────────────────────────────

  it('renders tier progress bar for tier 1 contributor', () => {
    render(<ContributorProfile {...defaultProps} tier={1} t1Completed={2} />);
    const progress = screen.getByTestId('tier-progress');
    expect(progress).toBeInTheDocument();
    expect(progress.textContent).toContain('2/4 T1 bounties toward Tier 2 access');
  });

  it('renders tier progress bar for tier 2 contributor', () => {
    render(
      <ContributorProfile {...defaultProps} tier={2} t1Completed={4} t2Completed={1} />,
    );
    const progress = screen.getByTestId('tier-progress');
    expect(progress).toBeInTheDocument();
    expect(progress.textContent).toContain('1/2 T2 bounties toward Tier 3 access');
  });

  it('renders max tier message for tier 3 contributor', () => {
    render(
      <ContributorProfile {...defaultProps} tier={3} t1Completed={4} t2Completed={2} />,
    );
    const progress = screen.getByTestId('tier-progress');
    expect(progress).toBeInTheDocument();
    expect(progress.textContent).toContain('Max tier reached');
  });

  // ── Copy wallet button tests ────────────────────────────────────────────────

  it('renders copy wallet button when wallet address is provided', () => {
    render(<ContributorProfile {...defaultProps} />);
    const btn = screen.getByTestId('copy-wallet-btn');
    expect(btn).toBeInTheDocument();
  });

  it('does not render copy button when wallet is empty', () => {
    render(<ContributorProfile {...defaultProps} walletAddress="" />);
    expect(screen.queryByTestId('copy-wallet-btn')).not.toBeInTheDocument();
  });

  it('calls clipboard API when copy button is clicked', () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<ContributorProfile {...defaultProps} />);
    fireEvent.click(screen.getByTestId('copy-wallet-btn'));
    expect(writeText).toHaveBeenCalledWith(defaultProps.walletAddress);
  });

  // ── Recent bounties tests ──────────────────────────────────────────────────

  it('renders recent bounties activity feed when provided', () => {
    const bounties = [
      {
        title: 'Fix login bug',
        issueUrl: 'https://github.com/org/repo/issues/1',
        tier: 1 as const,
        earned: 5000,
        completedAt: '2026-03-10T12:00:00Z',
      },
      {
        title: 'Add dark mode',
        issueUrl: 'https://github.com/org/repo/issues/2',
        tier: 2 as const,
        earned: 25000,
        completedAt: '2026-03-18T15:30:00Z',
      },
    ];
    render(<ContributorProfile {...defaultProps} recentBounties={bounties} />);
    const section = screen.getByTestId('recent-bounties');
    expect(section).toBeInTheDocument();
    expect(screen.getByText('Fix login bug')).toBeInTheDocument();
    expect(screen.getByText('Add dark mode')).toBeInTheDocument();
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
  });

  it('hides recent bounties section when empty array provided', () => {
    render(<ContributorProfile {...defaultProps} recentBounties={[]} />);
    expect(screen.queryByTestId('recent-bounties')).not.toBeInTheDocument();
  });

  it('hides recent bounties section when not provided', () => {
    render(<ContributorProfile {...defaultProps} />);
    expect(screen.queryByTestId('recent-bounties')).not.toBeInTheDocument();
  });

  // ── Join date tests ─────────────────────────────────────────────────────────

  it('renders join date when provided', () => {
    render(<ContributorProfile {...defaultProps} joinDate="2025-06-15T00:00:00Z" />);
    const joinEl = screen.getByTestId('join-date');
    expect(joinEl).toBeInTheDocument();
    expect(joinEl.textContent).toContain('Member since');
    expect(joinEl.textContent).toContain('2025');
  });

  it('does not render join date when not provided', () => {
    render(<ContributorProfile {...defaultProps} />);
    expect(screen.queryByTestId('join-date')).not.toBeInTheDocument();
  });

  // ── Bounty links in activity feed ──────────────────────────────────────────

  it('renders bounty links as anchor elements with correct href', () => {
    const bounties = [
      {
        title: 'Implement search',
        issueUrl: 'https://github.com/org/repo/issues/42',
        tier: 1 as const,
        earned: 10000,
        completedAt: '2026-03-20T10:00:00Z',
      },
    ];
    render(<ContributorProfile {...defaultProps} recentBounties={bounties} />);
    const link = screen.getByText('Implement search').closest('a');
    expect(link).toHaveAttribute('href', 'https://github.com/org/repo/issues/42');
    expect(link).toHaveAttribute('target', '_blank');
  });

  // ── Avatar rendering ──────────────────────────────────────────────────────

  it('renders avatar image with correct alt text', () => {
    render(<ContributorProfile {...defaultProps} />);
    const img = screen.getByAlt('testuser');
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.png');
  });
});
