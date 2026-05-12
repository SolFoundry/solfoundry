import type { LeaderboardEntry } from '../types/leaderboard';

export type ContributorTier = 'Novice' | 'Adept' | 'Master' | 'Grandmaster';
export type BadgeType = 'Gold' | 'Silver' | 'Bronze';

export function computeTier(reputation: number): ContributorTier {
  if (reputation >= 90) return 'Grandmaster';
  if (reputation >= 70) return 'Master';
  if (reputation >= 30) return 'Adept';
  return 'Novice';
}

export function computeBadges(bountiesCompleted: number): BadgeType[] {
  const badges: BadgeType[] = [];
  if (bountiesCompleted >= 1) badges.push('Bronze');
  if (bountiesCompleted >= 5) badges.push('Silver');
  if (bountiesCompleted >= 15) badges.push('Gold');
  // Sort badges high-to-low so highest is displayed first
  return badges.reverse();
}

/**
 * Ensures the entry has computed gamification fields if missing from the API.
 */
export function enrichLeaderboardEntry(entry: LeaderboardEntry): LeaderboardEntry {
  return {
    ...entry,
    tier: entry.tier ?? computeTier(entry.reputation),
    badges: entry.badges ?? computeBadges(entry.bountiesCompleted),
  };
}
