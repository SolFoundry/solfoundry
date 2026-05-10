import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BountyCardSkeleton, LeaderboardRowSkeleton, ProfileSectionSkeleton } from './LoadingSkeletons';

describe('LoadingSkeletons', () => {
  it('renders bounty card skeletons with shimmer and card shape', () => {
    render(<BountyCardSkeleton count={2} />);

    const skeletons = screen.getAllByLabelText(/loading bounty card/i);
    expect(skeletons).toHaveLength(2);
    expect(skeletons[0]).toHaveClass('animate-shimmer');
    expect(skeletons[0]).toHaveClass('rounded-xl');
  });

  it('renders leaderboard row skeletons with table row shape', () => {
    render(<LeaderboardRowSkeleton count={3} />);

    const rows = screen.getAllByLabelText(/loading leaderboard row/i);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveClass('grid');
  });

  it('renders profile section skeleton with avatar and stat placeholders', () => {
    render(<ProfileSectionSkeleton />);

    expect(screen.getByLabelText(/loading profile section/i)).toBeInTheDocument();
    expect(screen.getByTestId('profile-skeleton-avatar')).toHaveClass('rounded-full');
    expect(screen.getAllByTestId('profile-skeleton-stat')).toHaveLength(3);
  });
});
