/**
 * Skeleton - Reusable skeleton loading components
 * Supports: text line, card, avatar, table row with shimmer animation
 * @module components/common/Skeleton
 */

import React from 'react';

// ============================================================================
// Types
// ============================================================================

export type SkeletonRounded = 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

export interface SkeletonProps {
  /** Additional CSS classes */
  className?: string;
  /** Width of the skeleton (CSS value) */
  width?: string | number;
  /** Height of the skeleton (CSS value) */
  height?: string | number;
  /** Border radius preset (overridden by circle/pill variants) */
  rounded?: SkeletonRounded;
  /** Semantic shape presets */
  variant?: 'default' | 'circle' | 'pill';
  /** Number of times to repeat the skeleton */
  count?: number;
  /** Gap between repeated skeletons */
  gap?: string | number;
  /** Animation style */
  animation?: 'pulse' | 'shimmer' | 'none';
}

export interface SkeletonTextProps extends Omit<SkeletonProps, 'variant' | 'rounded'> {
  /** Number of lines to render */
  lines?: number;
  /** Line height */
  lineHeight?: string | number;
  /** Last line width percentage (0-100) */
  lastLineWidth?: number;
  /** Border radius for each line */
  rounded?: SkeletonRounded;
}

export interface SkeletonCardProps {
  /** Show avatar in card */
  showAvatar?: boolean;
  /** Show header line */
  showHeader?: boolean;
  /** Number of body lines */
  bodyLines?: number;
  /** Show footer */
  showFooter?: boolean;
  /** Additional classes */
  className?: string;
}

export interface SkeletonAvatarProps extends Omit<SkeletonProps, 'variant'> {
  /** Size preset */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export interface SkeletonTableRowProps {
  /** Number of columns */
  columns?: number;
  /** Show avatar in first data column (e.g. contributor name) */
  showAvatar?: boolean;
  /** Column widths (percentages) */
  columnWidths?: number[];
  /** Row class */
  className?: string;
}

const ROUNDED_MAP: Record<SkeletonRounded, string> = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  full: 'rounded-full',
};

// ============================================================================
// Base Skeleton Component
// ============================================================================

/**
 * Base skeleton element with shimmer/pulse animation
 */
export function Skeleton({
  className = '',
  width,
  height,
  rounded = 'lg',
  variant = 'default',
  animation = 'shimmer',
}: SkeletonProps) {
  const baseClasses = 'bg-gray-200 dark:bg-surface-200';

  const radiusClass =
    variant === 'circle' || variant === 'pill' ? 'rounded-full' : ROUNDED_MAP[rounded];

  const animationClasses: Record<string, string> = {
    pulse: 'animate-pulse',
    shimmer: 'animate-shimmer',
    none: '',
  };

  const style: React.CSSProperties = {};
  if (width !== undefined) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height !== undefined) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={`${baseClasses} ${radiusClass} ${animationClasses[animation]} ${className}`.trim()}
      style={style}
      role="presentation"
      aria-hidden="true"
    />
  );
}

// ============================================================================
// Skeleton Text
// ============================================================================

/**
 * Skeleton for text content - renders multiple lines
 */
export function SkeletonText({
  lines = 1,
  lineHeight = '1rem',
  lastLineWidth = 70,
  className = '',
  gap = '0.5rem',
  rounded = 'md',
  animation = 'shimmer',
  ...rest
}: SkeletonTextProps) {
  const gapValue = typeof gap === 'number' ? `${gap}px` : gap;

  return (
    <div
      className={`flex flex-col ${className}`.trim()}
      style={{ gap: gapValue }}
      role="presentation"
      aria-hidden="true"
    >
      {Array.from({ length: lines }, (_, i) => {
        const isLast = i === lines - 1 && lines > 1;
        const w = isLast ? `${lastLineWidth}%` : '100%';

        return (
          <Skeleton
            key={i}
            height={lineHeight}
            width={w}
            rounded={rounded}
            animation={animation}
            {...rest}
          />
        );
      })}
    </div>
  );
}

// ============================================================================
// Skeleton Card
// ============================================================================

/**
 * Skeleton for generic card content
 */
export function SkeletonCard({
  showAvatar = false,
  showHeader = true,
  bodyLines = 2,
  showFooter = false,
  className = '',
}: SkeletonCardProps) {
  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-surface-300 dark:bg-surface-50 ${className}`.trim()}
      role="presentation"
      aria-hidden="true"
    >
      {showHeader && (
        <div className="flex items-start gap-3 mb-3">
          {showAvatar && (
            <SkeletonAvatar size="md" className="shrink-0" />
          )}
          <div className="flex-1 flex flex-col gap-2">
            <Skeleton height="1.25rem" width="60%" rounded="md" />
            <Skeleton height="0.875rem" width="40%" rounded="md" />
          </div>
        </div>
      )}

      {bodyLines > 0 && (
        <div className="mb-3">
          <SkeletonText lines={bodyLines} lineHeight="0.875rem" lastLineWidth={75} rounded="md" />
        </div>
      )}

      {showFooter && (
        <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-surface-300">
          <Skeleton height="1.5rem" width="5rem" rounded="md" />
          <Skeleton height="1.5rem" width="4rem" rounded="md" />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Skeleton Avatar
// ============================================================================

/**
 * Skeleton for avatar with size presets
 */
export function SkeletonAvatar({
  size = 'md',
  className = '',
  animation = 'shimmer',
  ...rest
}: SkeletonAvatarProps) {
  const sizeMap: Record<string, { width: number; height: number }> = {
    xs: { width: 24, height: 24 },
    sm: { width: 32, height: 32 },
    md: { width: 40, height: 40 },
    lg: { width: 56, height: 56 },
    xl: { width: 80, height: 80 },
  };

  const { width, height } = sizeMap[size];

  return (
    <Skeleton
      variant="circle"
      width={width}
      height={height}
      className={className}
      animation={animation}
      {...rest}
    />
  );
}

// ============================================================================
// Skeleton Table Row
// ============================================================================

/**
 * Skeleton for table row - matches leaderboard, bounty table layouts
 */
export function SkeletonTableRow({
  columns = 4,
  showAvatar = false,
  columnWidths,
  className = '',
}: SkeletonTableRowProps) {
  const defaultWidths = Array.from({ length: columns }, (_, i) => {
    if (i === 0) return 40;
    if (i === columns - 1) return 80;
    return 100 / columns;
  });

  const widths = columnWidths ?? defaultWidths;

  return (
    <tr
      className={`border-b border-gray-200 dark:border-surface-300 ${className}`.trim()}
      role="presentation"
      aria-hidden="true"
    >
      {Array.from({ length: columns }, (_, i) => (
        <td key={i} className="py-3 px-2">
          <div className="flex items-center gap-2">
            {showAvatar && i === 1 && (
              <SkeletonAvatar size="sm" />
            )}
            <Skeleton
              height="1rem"
              width={`${widths[i]}%`}
              rounded="md"
            />
          </div>
        </td>
      ))}
    </tr>
  );
}

// ============================================================================
// Dashboard stat card (matches ContributorDashboard SummaryCard)
// ============================================================================

export function SkeletonStatCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={`bg-white dark:bg-surface-100 rounded-xl p-5 border border-gray-200 dark:border-white/5 shadow-sm dark:shadow-none ${className}`.trim()}
      role="presentation"
      aria-hidden="true"
    >
      <div className="flex items-center justify-between mb-3">
        <Skeleton height="0.875rem" width="45%" rounded="md" />
        <Skeleton height={40} width={40} rounded="lg" className="shrink-0" />
      </div>
      <Skeleton height="1.75rem" width="55%" rounded="md" />
      <Skeleton height="0.75rem" width="35%" rounded="md" className="mt-3" />
    </div>
  );
}

// ============================================================================
// Bounty marketplace — matches BountyCard (grid)
// ============================================================================

export function SkeletonBountyCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={`relative w-full rounded-xl border border-gray-200 bg-white dark:border-surface-300 dark:bg-surface-50 p-5 ${className}`.trim()}
      role="presentation"
      aria-hidden="true"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Skeleton height="1.25rem" width="2rem" rounded="md" />
          <Skeleton height="1rem" width="3.5rem" rounded="full" variant="pill" />
        </div>
        <Skeleton height="1.25rem" width="4.5rem" rounded="md" />
      </div>
      <Skeleton height="0.875rem" width="88%" rounded="md" className="mb-2" />
      <Skeleton height="0.75rem" width="38%" rounded="md" className="mb-3" />
      <div className="flex items-baseline gap-2 mb-3">
        <Skeleton height="1.35rem" width="3.25rem" rounded="md" />
        <Skeleton height="0.7rem" width="2.25rem" rounded="md" />
      </div>
      <div className="flex flex-wrap gap-2 mb-1">
        {[0, 1, 2].map(i => (
          <Skeleton key={i} height="1.25rem" width="3.25rem" rounded="full" variant="pill" />
        ))}
      </div>
      <div className="flex justify-between pt-3 mt-3 border-t border-gray-200 dark:border-surface-300">
        <Skeleton height="0.75rem" width="4.5rem" rounded="md" />
        <Skeleton height="0.75rem" width="5.5rem" rounded="md" />
      </div>
    </div>
  );
}

// ============================================================================
// Bounty marketplace — matches BountyListView rows
// ============================================================================

export function SkeletonBountyListRows({ count = 6, className = '' }: { count?: number; className?: string }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`.trim()} role="presentation" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 px-4 py-3 rounded-lg border border-gray-200 bg-white dark:border-surface-300 dark:bg-surface-50"
        >
          <div className="flex gap-2 shrink-0">
            <Skeleton height="1.25rem" width="2rem" rounded="md" />
            <Skeleton height="1rem" width="3.25rem" rounded="full" variant="pill" />
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <Skeleton height="0.875rem" width="72%" rounded="md" />
            <div className="flex flex-wrap gap-1">
              {[0, 1, 2].map(j => (
                <Skeleton key={j} height="1rem" width="2.75rem" rounded="full" variant="pill" />
              ))}
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-5 shrink-0">
            <Skeleton height="1rem" width="48px" rounded="md" />
            <Skeleton height="1rem" width="40px" rounded="md" />
            <Skeleton height="1rem" width="52px" rounded="md" />
            <Skeleton height="1rem" width="44px" rounded="md" />
            <Skeleton height="1.25rem" width="72px" rounded="md" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Contributor profile page (matches ContributorProfile dark card)
// ============================================================================

export function SkeletonContributorProfile({ className = '' }: { className?: string }) {
  return (
    <div
      className={`bg-gray-900 rounded-lg p-4 sm:p-6 space-y-6 ${className}`.trim()}
      role="presentation"
      aria-hidden="true"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Skeleton
          variant="circle"
          className="w-16 h-16 sm:w-20 sm:h-20 mx-auto sm:mx-0 shrink-0"
        />
        <div className="flex-1 flex flex-col gap-2 items-center sm:items-start">
          <Skeleton height="1.5rem" width="200px" rounded="md" className="max-w-[60%] bg-gray-700 dark:bg-gray-700" />
          <Skeleton height="0.8rem" width="160px" rounded="md" className="max-w-[50%] bg-gray-700 dark:bg-gray-700" />
        </div>
        <Skeleton height="2rem" width="5rem" rounded="full" variant="pill" className="self-center sm:self-start bg-gray-700 dark:bg-gray-700" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {[0, 1, 2].map(i => (
          <div key={i} className="bg-gray-800 rounded-lg p-4 space-y-2">
            <Skeleton height="0.75rem" width="50%" rounded="md" className="bg-gray-700 dark:bg-gray-700" />
            <Skeleton height="1.35rem" width="70%" rounded="md" className="bg-gray-700 dark:bg-gray-700" />
          </div>
        ))}
      </div>
      <Skeleton height="3rem" width="100%" rounded="lg" className="bg-gray-700 dark:bg-gray-700" />
    </div>
  );
}

// ============================================================================
// Skeleton Grid
// ============================================================================

export interface SkeletonGridProps {
  /** Number of skeleton cards to render */
  count?: number;
  /** Grid columns (responsive) */
  columns?: 1 | 2 | 3 | 4;
  /** Card variant */
  variant?: 'card' | 'list';
  /** Gap between cards */
  gap?: string;
  /** Show avatar in cards */
  showAvatar?: boolean;
  /** Additional classes */
  className?: string;
}

/**
 * Skeleton grid for loading states of card grids
 */
export function SkeletonGrid({
  count = 6,
  columns = 3,
  variant = 'card',
  gap = '1rem',
  showAvatar = false,
  className = '',
}: SkeletonGridProps) {
  const columnClasses: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  };

  if (variant === 'list') {
    return (
      <div className={`space-y-3 ${className}`.trim()} role="presentation" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <SkeletonCard
            key={i}
            showAvatar={showAvatar}
            bodyLines={2}
            showFooter
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`grid ${columnClasses[columns]} ${className}`.trim()}
      style={{ gap }}
      role="presentation"
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, i) => (
        <SkeletonBountyCard key={i} />
      ))}
    </div>
  );
}

// ============================================================================
// Skeleton List (legacy layout — prefer SkeletonBountyCard grid / SkeletonBountyListRows)
// ============================================================================

export interface SkeletonListProps {
  /** Number of items */
  count?: number;
  /** Show tier badge area */
  showTier?: boolean;
  /** Show skills tags */
  showSkills?: boolean;
  /** Additional classes */
  className?: string;
}

/**
 * Vertical list placeholder; marketplace uses SkeletonBountyCard in a grid for parity with BountyCard.
 */
export function SkeletonList({
  count = 5,
  className = '',
}: SkeletonListProps) {
  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 ${className}`.trim()}
      role="presentation"
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, i) => (
        <SkeletonBountyCard key={i} />
      ))}
    </div>
  );
}

// ============================================================================
// Skeleton Table
// ============================================================================

export interface SkeletonTableProps {
  /** Number of rows */
  rows?: number;
  /** Number of columns */
  columns?: number;
  /** Show avatar in second column */
  showAvatar?: boolean;
  /** Additional classes */
  className?: string;
}

/**
 * Skeleton table for leaderboard and data tables
 */
export function SkeletonTable({
  rows = 10,
  columns = 5,
  showAvatar = false,
  className = '',
}: SkeletonTableProps) {
  return (
    <table className={`w-full text-sm ${className}`.trim()} role="presentation" aria-hidden="true">
      <thead>
        <tr className="border-b border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-400 text-left text-xs">
          {Array.from({ length: columns }, (_, i) => (
            <th key={i} className="py-2">
              <Skeleton height="0.75rem" width="3rem" rounded="md" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }, (_, i) => (
          <SkeletonTableRow key={i} columns={columns} showAvatar={showAvatar} />
        ))}
      </tbody>
    </table>
  );
}

// ============================================================================
// Skeleton Activity Feed
// ============================================================================

export interface SkeletonActivityFeedProps {
  /** Number of activity items */
  count?: number;
  /** Additional classes */
  className?: string;
}

/**
 * Skeleton for activity feed loading state
 */
export function SkeletonActivityFeed({
  count = 5,
  className = '',
}: SkeletonActivityFeedProps) {
  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white dark:border-surface-300 dark:bg-surface-50 ${className}`.trim()}
      role="presentation"
      aria-hidden="true"
    >
      <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-surface-300">
        <div className="flex items-center gap-2">
          <Skeleton height="0.5rem" width="0.5rem" variant="circle" />
          <Skeleton height="1rem" width="6rem" rounded="md" />
        </div>
        <Skeleton height="0.75rem" width="4rem" rounded="md" />
      </div>

      <div className="divide-y divide-gray-200 dark:divide-surface-300">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="flex items-start gap-3 p-4">
            <Skeleton height="2rem" width="2rem" rounded="lg" className="shrink-0" />
            <div className="flex-1 flex flex-col gap-2">
              <Skeleton height="0.875rem" width="80%" rounded="md" />
              <Skeleton height="0.625rem" width="4rem" rounded="md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Skeleton;
