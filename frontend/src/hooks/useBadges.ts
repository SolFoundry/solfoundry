/**
 * Hook to compute badge states from contributor stats
 */

import { useMemo } from 'react';
import { BadgeState, ContributorStats } from '../types/badge';
import { BADGE_DEFINITIONS } from '../config/badges';

export function useBadges(stats: ContributorStats): BadgeState[] {
  return useMemo(() => {
    const {
      prsMerged,
      prsWithNoRevisions,
      isMonthlyTop,
      prTimestamps,
    } = stats;

    // Check for night owl (PR between midnight and 5am UTC)
    const hasNightOwl = prTimestamps.some((ts) => {
      const hour = new Date(ts * 1000).getUTCHours();
      return hour >= 0 && hour < 5;
    });

    return BADGE_DEFINITIONS.map((def) => {
      let earned = false;
      let progress = 0;
      let maxProgress: number | undefined;

      switch (def.id) {
        case 'first_blood':
          earned = prsMerged >= 1;
          progress = Math.min(prsMerged, 1);
          maxProgress = 1;
          break;
        case 'on_fire':
          earned = prsMerged >= 3;
          progress = Math.min(prsMerged, 3);
          maxProgress = 3;
          break;
        case 'rising_star':
          earned = prsMerged >= 5;
          progress = Math.min(prsMerged, 5);
          maxProgress = 5;
          break;
        case 'diamond_hands':
          earned = prsMerged >= 10;
          progress = Math.min(prsMerged, 10);
          maxProgress = 10;
          break;
        case 'top_contributor':
          earned = isMonthlyTop;
          break;
        case 'sharpshooter':
          earned = prsWithNoRevisions >= 3;
          progress = Math.min(prsWithNoRevisions, 3);
          maxProgress = 3;
          break;
        case 'night_owl':
          earned = hasNightOwl;
          break;
      }

      return { id: def.id, earned, progress, maxProgress };
    });
  }, [stats]);
}