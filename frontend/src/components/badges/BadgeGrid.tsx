'use client';

import React from 'react';
import { BadgeState } from '../../types/badge';
import { Badge } from './Badge';

interface BadgeGridProps {
  badges: BadgeState[];
  showProgress?: boolean;
}

export const BadgeGrid: React.FC<BadgeGridProps> = ({ badges, showProgress = true }) => {
  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <div className="space-y-2">
      {/* Badge count summary */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">Badges</h3>
        <span className="text-xs text-gray-400">
          {earnedCount} / {badges.length} earned
        </span>
      </div>
      
      {/* Badge grid */}
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
        {badges.map((badge) => (
          <Badge key={badge.id} badge={badge} showProgress={showProgress} />
        ))}
      </div>
    </div>
  );
};

export default BadgeGrid;