import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  BountyDetailSkeleton,
  BountyGridSkeleton,
  LeaderboardSkeleton,
  ProfileBountyListSkeleton,
} from '../components/ui/Skeletons';

describe('loading skeletons', () => {
  it('renders content-shaped bounty card placeholders with shimmer animation', () => {
    render(<BountyGridSkeleton count={3} />);

    expect(screen.getByRole('status', { name: /loading bounties/i })).toBeInTheDocument();
    expect(screen.getAllByTestId('bounty-card-skeleton')).toHaveLength(3);
    expect(document.querySelector('.animate-shimmer')).toBeInTheDocument();
  });

  it('renders leaderboard row placeholders instead of a spinner-only state', () => {
    render(<LeaderboardSkeleton />);

    expect(screen.getByRole('status', { name: /loading leaderboard/i })).toBeInTheDocument();
    expect(screen.getAllByTestId('leaderboard-row-skeleton')).toHaveLength(5);
  });

  it('renders profile and detail placeholders with accessible status labels', () => {
    const { rerender } = render(<ProfileBountyListSkeleton />);
    expect(screen.getByRole('status', { name: /loading profile bounties/i })).toBeInTheDocument();
    expect(screen.getAllByTestId('profile-bounty-skeleton')).toHaveLength(4);

    rerender(<BountyDetailSkeleton />);
    expect(screen.getByRole('status', { name: /loading bounty detail/i })).toBeInTheDocument();
  });
});
