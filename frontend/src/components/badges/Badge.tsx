'use client';

import React from 'react';
import { BadgeDefinition, BadgeState } from '../../types/badge';
import { BADGE_DEFINITIONS } from '../../config/badges';

interface BadgeProps {
  badge: BadgeState;
  showProgress?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({ badge, showProgress = true }) => {
  const definition = BADGE_DEFINITIONS.find((d) => d.id === badge.id);
  
  if (!definition) {
    return null;
  }

  const { name, description, icon } = definition;
  const { earned, progress, maxProgress } = badge;

  return (
    <div
      className={`relative group flex flex-col items-center justify-center p-3 rounded-lg transition-all ${
        earned
          ? 'bg-gray-800 hover:bg-gray-700'
          : 'bg-gray-900 opacity-50'
      }`}
      title={description}
    >
      {/* Badge Icon */}
      <span className={`text-2xl ${!earned ? 'grayscale' : ''}`}>
        {icon}
      </span>
      
      {/* Lock overlay for unearned badges */}
      {!earned && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-gray-600 text-xs">🔒</span>
        </div>
      )}
      
      {/* Badge Name */}
      <span className={`text-xs mt-1 text-center ${earned ? 'text-white' : 'text-gray-500'}`}>
        {name}
      </span>
      
      {/* Progress indicator */}
      {showProgress && !earned && maxProgress !== undefined && progress !== undefined && progress > 0 && (
        <div className="w-full mt-1">
          <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 rounded-full transition-all"
              style={{ width: `${(progress / maxProgress) * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-gray-500 text-center block mt-0.5">
            {progress}/{maxProgress}
          </span>
        </div>
      )}
      
      {/* Tooltip on hover */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-950 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
        {description}
      </div>
    </div>
  );
};

export default Badge;