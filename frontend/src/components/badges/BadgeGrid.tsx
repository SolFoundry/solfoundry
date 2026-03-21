/**
 * BadgeGrid component - Displays a grid of badges on contributor profiles.
 * Supports earned-only filter and responsive column layout.
 * @module components/badges/BadgeGrid
 */

import React from 'react';
import type { BadgeGridProps, BadgeStatus } from '../../types/badge';
import { Badge } from './Badge';

/**
 * BadgeGrid component for displaying all badges on a profile.
 * 
 * Features:
 * - Responsive grid layout
 * - Option to show only earned badges
 * - Earned badges grouped at the top
 * - Configurable number of columns
 */
export function BadgeGrid({
  badges,
  columns = 4,
  earnedOnly = false,
}: BadgeGridProps): React.ReactElement {
  // Sort badges: earned first, then by category
  const sortedBadges = React.useMemo(() => {
    const sorted = [...badges];
    sorted.sort((a, b) => {
      // Earned badges first
      if (a.earned && !b.earned) return -1;
      if (!a.earned && b.earned) return 1;
      
      // Then by category order: milestone, quality, special
      const categoryOrder = { milestone: 0, quality: 1, special: 2 };
      const catA = categoryOrder[a.badge.category] ?? 2;
      const catB = categoryOrder[b.badge.category] ?? 2;
      if (catA !== catB) return catA - catB;
      
      // Then by requirement (lower first)
      const reqA = a.badge.requirement ?? 999;
      const reqB = b.badge.requirement ?? 999;
      return reqA - reqB;
    });
    return sorted;
  }, [badges]);

  // Filter badges if earnedOnly is true
  const displayBadges = earnedOnly
    ? sortedBadges.filter(b => b.earned)
    : sortedBadges;

  // Grid column classes
  const gridClasses = {
    2: 'grid-cols-2 sm:grid-cols-2',
    3: 'grid-cols-2 sm:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
  };

  // Count earned badges
  const earnedCount = badges.filter(b => b.earned).length;
  const totalCount = badges.length;

  // Handle empty states - earnedOnly-specific message must come before generic empty state
  if (displayBadges.length === 0) {
    if (earnedOnly) {
      return (
        <div className="text-center py-8 text-gray-400">
          <p className="text-lg">No badges earned yet</p>
          <p className="text-sm mt-1">Keep contributing to unlock achievements!</p>
        </div>
      );
    }
    return (
      <div className="text-center py-8 text-gray-400">
        <p className="text-lg">No badges yet</p>
        <p className="text-sm mt-1">Complete bounties to earn badges!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Badge Count Header */}
      {!earnedOnly && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="text-2xl">🏆</span>
            Achievements
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-[#14F195] font-bold text-lg">{earnedCount}</span>
            <span className="text-gray-400">/ {totalCount} earned</span>
          </div>
        </div>
      )}

      {/* Badge Grid */}
      <div className={`grid ${gridClasses[columns]} gap-4 sm:gap-6`}>
        {displayBadges.map((badgeStatus: BadgeStatus) => (
          <Badge
            key={badgeStatus.badge.id}
            badge={badgeStatus.badge}
            earned={badgeStatus.earned}
            earnedAt={badgeStatus.earnedAt}
            progress={badgeStatus.progress}
            size="md"
          />
        ))}
      </div>
    </div>
  );
}

export default BadgeGrid;