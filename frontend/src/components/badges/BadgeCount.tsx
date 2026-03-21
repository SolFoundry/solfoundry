'use client';

import React from 'react';
import { BadgeState } from '../../types/badge';

interface BadgeCountProps {
  badges: BadgeState[];
  showLabel?: boolean;
}

export const BadgeCount: React.FC<BadgeCountProps> = ({ badges, showLabel = true }) => {
  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <div className="flex items-center gap-1">
      <span className="text-lg">🏆</span>
      <span className="text-sm font-bold text-yellow-400">{earnedCount}</span>
      {showLabel && (
        <span className="text-xs text-gray-400">badges</span>
      )}
    </div>
  );
};

export default BadgeCount;