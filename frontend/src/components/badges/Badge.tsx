/**
 * Badge — Individual achievement badge with tooltip, earned/locked states,
 * and micro-animations.
 * @module Badge
 */
import { useState, useRef, useEffect } from 'react';
import type { BadgeWithStatus } from '../../types/badges';

interface BadgeProps {
  badge: BadgeWithStatus;
  /** Stagger index for pop-in animation (0-based) */
  index?: number;
}

export function Badge({ badge, index = 0 }: BadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const badgeRef = useRef<HTMLDivElement>(null);

  // Clean up tooltip timeout on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
    };
  }, []);

  const handleMouseEnter = () => {
    tooltipTimeout.current = setTimeout(() => setShowTooltip(true), 250);
  };

  const handleMouseLeave = () => {
    if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
    setShowTooltip(false);
  };

  const handleFocus = () => setShowTooltip(true);
  const handleBlur = () => setShowTooltip(false);

  const earned = badge.earned;

  return (
    <div
      ref={badgeRef}
      className={[
        // Layout & shape
        'relative flex flex-col items-center gap-1.5 rounded-xl p-3 sm:p-4',
        // Border
        'border transition-all duration-300',
        // Pop-in animation
        'animate-badge-pop',
        // Earned vs locked styles
        earned
          ? 'border-purple-500/40 bg-gradient-to-br from-gray-800/90 to-gray-900/80 text-white cursor-pointer hover:border-purple-400/60'
          : 'border-gray-700/50 bg-gray-900/40 text-gray-500 cursor-default',
        // Shine on earned badges
        earned ? 'animate-badge-shine' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ animationDelay: `${index * 80}ms`, animationFillMode: 'both' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      tabIndex={0}
      role="listitem"
      aria-label={`${badge.name}: ${badge.description}${earned ? ' — Earned' : ' — Locked'}`}
      data-testid={`profile-badge-${badge.id}`}
    >
      {/* Glow aura on hover for earned badges */}
      {earned && (
        <div
          className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 animate-badge-glow"
          aria-hidden
        />
      )}

      {/* Icon */}
      <span
        className={[
          'text-2xl sm:text-3xl select-none transition-transform duration-200',
          earned ? 'hover:scale-110' : 'grayscale opacity-40',
        ].join(' ')}
        aria-hidden
      >
        {badge.icon}
      </span>

      {/* Name */}
      <p
        className={[
          'text-xs sm:text-sm font-semibold text-center leading-tight',
          earned ? 'text-white' : 'text-gray-500',
        ].join(' ')}
      >
        {badge.name}
      </p>

      {/* Lock overlay for unearned */}
      {!earned && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-black/25 backdrop-blur-[1px]">
          <span className="flex items-center gap-1 rounded-full border border-gray-600/60 bg-gray-900/80 px-2 py-0.5 text-[10px] font-medium text-gray-400">
            <svg
              className="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
            LOCKED
          </span>
        </div>
      )}

      {/* Tooltip */}
      {showTooltip && (
        <div
          role="tooltip"
          className={[
            'absolute -bottom-12 left-1/2 -translate-x-1/2 z-20',
            'whitespace-nowrap rounded-lg px-3 py-1.5',
            'text-xs font-medium shadow-lg',
            'animate-tooltip-reveal',
            earned
              ? 'bg-gradient-to-r from-solana-purple to-solana-green text-white'
              : 'bg-gray-800 border border-gray-700 text-gray-300',
          ].join(' ')}
        >
          {badge.description}
          {/* Arrow */}
          <div
            className={[
              'absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45',
              earned ? 'bg-solana-purple' : 'bg-gray-800 border-l border-t border-gray-700',
            ].join(' ')}
            aria-hidden
          />
        </div>
      )}
    </div>
  );
}
