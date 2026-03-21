/**
 * BadgeCount component - Displays badge count on profile cards.
 * Shows earned/total badges with a visual indicator.
 * @module components/badges/BadgeCount
 */

import React from 'react';
import type { BadgeCountProps } from '../../types/badge';

/**
 * BadgeCount component for profile cards.
 * 
 * Features:
 * - Compact display of badge count
 * - Visual progress indicator
 * - Hover effect for interactivity
 */
export function BadgeCount({
  count,
  total,
}: BadgeCountProps): React.ReactElement {
  // Calculate percentage for progress bar
  const percentage = total > 0 ? (count / total) * 100 : 0;

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
      {/* Trophy Icon */}
      <div className="w-10 h-10 rounded-lg bg-[#FFD700]/10 flex items-center justify-center shrink-0">
        <span className="text-xl">🏆</span>
      </div>

      {/* Badge Count Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-gray-400">Badges</span>
          <span className="text-sm font-medium">
            <span className="text-[#14F195]">{count}</span>
            <span className="text-gray-500">/{total}</span>
          </span>
        </div>
        
        {/* Progress Bar */}
        <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#9945FF] to-[#14F195] transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default BadgeCount;