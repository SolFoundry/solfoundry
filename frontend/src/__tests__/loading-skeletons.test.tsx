import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  BountyDetailSkeleton,
  BountyGridSkeleton,
  LeaderboardSkeleton,
  ProfileBountiesSkeleton,
} from '../components/ui/Skeleton';

describe('loading skeletons', () => {
  it('renders shaped bounty card skeletons with shimmer animation', () => {
    const { container } = render(<BountyGridSkeleton count={3} />);

    expect(screen.getByRole('status', { name: /loading bounties/i })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getAllByTestId('bounty-card-skeleton')).toHaveLength(3);
    expect(container.querySelector('.animate-shimmer')).toBeInTheDocument();
  });

  it('renders leaderboard podium and row skeletons', () => {
    render(<LeaderboardSkeleton />);

    expect(screen.getByRole('status', { name: /loading leaderboard/i })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getAllByTestId('leaderboard-podium-skeleton')).toHaveLength(3);
    expect(screen.getAllByTestId('leaderboard-row-skeleton')).toHaveLength(5);
  });

  it('renders profile bounty row skeletons', () => {
    render(<ProfileBountiesSkeleton />);

    expect(screen.getByRole('status', { name: /loading profile bounties/i })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getAllByTestId('profile-bounty-skeleton')).toHaveLength(4);
  });

  it('renders the bounty detail skeleton shell', () => {
    render(<BountyDetailSkeleton />);

    expect(screen.getByRole('status', { name: /loading bounty details/i })).toHaveAttribute('aria-busy', 'true');
  });
});
