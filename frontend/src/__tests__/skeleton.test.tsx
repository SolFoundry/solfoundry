import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BountyCardSkeleton, LeaderboardSkeleton, ProfileSectionSkeleton } from '../components/ui/Skeleton';

describe('loading skeletons', () => {
  it('renders bounty card skeleton with shimmer blocks hidden from assistive tech', () => {
    render(<BountyCardSkeleton />);
    expect(screen.getByTestId('bounty-card-skeleton')).toBeDefined();
    expect(document.querySelectorAll('[aria-hidden="true"].animate-shimmer').length).toBeGreaterThan(0);
  });

  it('renders leaderboard and profile skeleton containers', () => {
    render(
      <>
        <LeaderboardSkeleton />
        <ProfileSectionSkeleton />
      </>,
    );

    expect(screen.getByTestId('leaderboard-skeleton')).toBeDefined();
    expect(screen.getByTestId('profile-section-skeleton')).toBeDefined();
  });
});
