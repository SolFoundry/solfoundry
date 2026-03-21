/**
 * Hook to compute badge status from contributor stats.
 * Badges are computed client-side from contributor data.
 * @module hooks/useBadges
 */

import { useMemo } from 'react';
import type { BadgeStatus, ContributorStats } from '../types/badge';
import { BADGE_DEFINITIONS } from '../config/badges';

/**
 * Compute badge statuses from contributor stats.
 * 
 * @param stats - Contributor statistics
 * @returns Array of badge statuses
 */
export function useBadges(stats: ContributorStats | null): BadgeStatus[] {
  return useMemo(() => {
    if (!stats) {
      // Return all badges as unearned if no stats
      return BADGE_DEFINITIONS.map(badge => ({
        badge,
        earned: false,
        progress: 0,
      }));
    }

    const {
      mergedPRCount = 0,
      cleanMergeCount = 0,
      prsThisMonth = 0,
      topMonthlyPRCount = 0,
      nightOwlPRs = 0,
      prTimestamps = [],
    } = stats;

    return BADGE_DEFINITIONS.map(badgeDef => {
      let earned = false;
      let earnedAt: string | undefined;
      let progress = 0;

      switch (badgeDef.id) {
        case 'first_blood':
          earned = mergedPRCount >= 1;
          progress = Math.min(100, (mergedPRCount / 1) * 100);
          if (earned && prTimestamps[0]) {
            earnedAt = prTimestamps[0];
          }
          break;

        case 'on_fire':
          earned = mergedPRCount >= 3;
          progress = Math.min(100, (mergedPRCount / 3) * 100);
          if (earned && prTimestamps[2]) {
            earnedAt = prTimestamps[2];
          }
          break;

        case 'rising_star':
          earned = mergedPRCount >= 5;
          progress = Math.min(100, (mergedPRCount / 5) * 100);
          if (earned && prTimestamps[4]) {
            earnedAt = prTimestamps[4];
          }
          break;

        case 'diamond_hands':
          earned = mergedPRCount >= 10;
          progress = Math.min(100, (mergedPRCount / 10) * 100);
          if (earned && prTimestamps[9]) {
            earnedAt = prTimestamps[9];
          }
          break;

        case 'top_contributor':
          // Must have the most PRs this month and at least 1 PR
          earned = prsThisMonth > 0 && prsThisMonth >= topMonthlyPRCount;
          progress = topMonthlyPRCount > 0 
            ? Math.min(100, (prsThisMonth / topMonthlyPRCount) * 100)
            : 0;
          break;

        case 'sharpshooter':
          earned = cleanMergeCount >= 3;
          progress = Math.min(100, (cleanMergeCount / 3) * 100);
          break;

        case 'night_owl':
          earned = nightOwlPRs >= 1;
          progress = Math.min(100, (nightOwlPRs / 1) * 100);
          break;

        default:
          break;
      }

      return {
        badge: badgeDef,
        earned,
        earnedAt,
        progress: earned ? 100 : progress,
      };
    });
  }, [stats]);
}

/**
 * Get count of earned badges.
 * 
 * @param badges - Array of badge statuses
 * @returns Number of earned badges
 */
export function useBadgeCount(badges: BadgeStatus[]): { earned: number; total: number } {
  return useMemo(() => {
    const earned = badges.filter(b => b.earned).length;
    return {
      earned,
      total: badges.length,
    };
  }, [badges]);
}

export default useBadges;