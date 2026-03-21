/**
 * Badge component - Displays a single badge with icon, name, and description tooltip.
 * Supports earned and locked (unearned) states with progress indicator.
 * @module components/badges/Badge
 */

import React, { useState } from 'react';
import type { BadgeProps } from '../../types/badge';

/**
 * Badge component for displaying contributor achievements.
 * 
 * Features:
 * - Shows icon, name, and description on hover
 * - Earned badges are colorful with full opacity
 * - Locked badges are greyed out with a lock overlay
 * - Progress bar for unearned badges
 */
export function Badge({
  badge,
  earned,
  earnedAt,
  progress = 0,
  size = 'md',
}: BadgeProps): React.ReactElement {
  const [showTooltip, setShowTooltip] = useState(false);

  // Size classes
  const sizeClasses = {
    sm: 'w-12 h-12 text-xl',
    md: 'w-16 h-16 text-2xl',
    lg: 'w-20 h-20 text-3xl',
  };

  // Format earned date for tooltip
  const formattedDate = earnedAt
    ? new Date(earnedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div className="relative inline-flex flex-col items-center group">
      {/* Badge Icon Container */}
      <div
        className={`
          ${sizeClasses[size]}
          rounded-xl
          flex items-center justify-center
          transition-all duration-200
          relative
          ${earned
            ? 'bg-gradient-to-br from-[#9945FF]/20 to-[#14F195]/20 border-2 border-[#9945FF]/50 shadow-lg shadow-[#9945FF]/20'
            : 'bg-gray-800/50 border-2 border-gray-700/50 opacity-50 grayscale'
          }
        `}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        tabIndex={0}
        role="button"
        aria-label={`${badge.name}: ${badge.description}. ${earned ? 'Earned' : 'Not yet earned'}`}
      >
        {/* Badge Icon */}
        <span className={earned ? '' : 'opacity-40'}>{badge.icon}</span>

        {/* Lock Overlay for Unearned Badges */}
        {!earned && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl">
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
          </div>
        )}

        {/* Progress Ring for Unearned Badges */}
        {!earned && progress > 0 && (
          <svg
            className="absolute inset-0 w-full h-full -rotate-90"
            viewBox="0 0 64 64"
          >
            <circle
              cx="32"
              cy="32"
              r="30"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-gray-700"
            />
            <circle
              cx="32"
              cy="32"
              r="30"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray={`${(progress / 100) * 188.5} 188.5`}
              className="text-[#14F195]"
            />
          </svg>
        )}
      </div>

      {/* Badge Name */}
      <span
        className={`
          mt-2 text-xs font-medium text-center
          ${earned ? 'text-white' : 'text-gray-500'}
        `}
      >
        {badge.name}
      </span>

      {/* Tooltip */}
      {showTooltip && (
        <div
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-3
                     bg-gray-800 border border-gray-700 rounded-lg shadow-xl
                     text-sm text-gray-200 animate-fade-in"
          role="tooltip"
        >
          {/* Badge Name */}
          <p className="font-bold text-white flex items-center gap-2">
            <span>{badge.icon}</span>
            <span>{badge.name}</span>
          </p>

          {/* Description */}
          <p className="mt-1 text-gray-400">{badge.description}</p>

          {/* Earned Date */}
          {earned && formattedDate && (
            <p className="mt-2 text-xs text-[#14F195]">
              Earned on {formattedDate}
            </p>
          )}

          {/* Progress for Unearned */}
          {!earned && progress > 0 && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#9945FF] to-[#14F195] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Category Badge */}
          <span
            className={`
              inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium
              ${
                badge.category === 'milestone'
                  ? 'bg-purple-500/20 text-purple-300'
                  : badge.category === 'quality'
                  ? 'bg-green-500/20 text-green-300'
                  : 'bg-yellow-500/20 text-yellow-300'
              }
            `}
          >
            {badge.category}
          </span>

          {/* Tooltip Arrow */}
          <div
            className="absolute top-full left-1/2 -translate-x-1/2 -mt-1
                        border-4 border-transparent border-t-gray-800"
          />
        </div>
      )}
    </div>
  );
}

export default Badge;