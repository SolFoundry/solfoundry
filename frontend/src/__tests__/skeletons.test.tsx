import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BountyCardSkeleton, LeaderboardRowSkeleton, ProfileBountyRowSkeleton, ProfileSummarySkeleton } from '../components/loading/Skeletons';

describe('loading skeletons', () => {
  it('renders bounty card skeleton', () => {
    render(<BountyCardSkeleton />);
    expect(screen.getByRole('generic', { busy: true })).toBeInTheDocument();
  });

  it('renders leaderboard row skeleton', () => {
    render(<LeaderboardRowSkeleton />);
    expect(screen.getByRole('generic', { busy: true })).toBeInTheDocument();
  });

  it('renders profile row skeleton', () => {
    render(<ProfileBountyRowSkeleton />);
    expect(screen.getByRole('generic', { busy: true })).toBeInTheDocument();
  });

  it('renders profile summary skeleton', () => {
    render(<ProfileSummarySkeleton />);
    expect(screen.getByRole('generic', { busy: true })).toBeInTheDocument();
  });
});
