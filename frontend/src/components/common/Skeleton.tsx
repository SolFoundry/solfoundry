/**
 * Skeleton - Reusable skeleton loading components
 * Supports: text line, card, avatar, table row with shimmer animation
 * @module components/common/Skeleton
 */

import React from 'react';

// ============================================================================
// Types
// ============================================================================

export interface SkeletonProps {
  /** Additional CSS classes */
  className?: string;
  /** Width of the skeleton (CSS value) */
  width?: string | number;
  /** Height of the skeleton (CSS value) */
  height?: string | number;
  /** Border radius variant */
  variant?: 'default' | 'circle' | 'pill';
  /** Number of times to repeat the skeleton */
  count?: number;
  /** Gap between repeated skeletons */
  gap?: string | number;
  /** Animation style */
  animation?: 'pulse' | 'shimmer' | 'none';
}

export interface SkeletonTextProps extends Omit<SkeletonProps, 'variant'> {
  /** Number of lines to render */
  lines?: number;
  /** Line height */
  lineHeight?: string | number;
  /** Last line width percentage (0-100) */
  lastLineWidth?: number;
}

export interface SkeletonCardProps extends SkeletonProps {
  /** Show avatar in card */
  showAvatar?: boolean;
  /** Show header line */
  showHeader?: boolean;
  /** Number of body lines */
  bodyLines?: number;
  /** Show footer */
  showFooter?: boolean;
}

export interface SkeletonAvatarProps extends SkeletonProps {
  /** Size preset */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export interface SkeletonTableRowProps extends SkeletonProps {
  /** Number of columns */
  columns?: number;
  /** Show avatar in first column */
  showAvatar?: boolean;
  /** Column widths (percentages) */
  columnWidths?: number[];
}

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
  variant = 'default',
  animation = 'pulse',
}: SkeletonProps) {
  const baseClasses = 'bg-surface-200';
  
  const variantClasses: Record<string, string> = {
    default: 'rounded-lg',
    circle: 'rounded-full!',
    pill: 'rounded-full!',
  };

  const animationClasses: Record<string, string> = {
    pulse: 'animate-pulse',
    shimmer: 'animate-shimmer',
    none: '',
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
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
  ...props
}: SkeletonTextProps) {
  const gapValue = typeof gap === 'number' ? `${gap}px` : gap;
  
  return (
    <div className={`space-y-[${gapValue}] ${className}`} role="presentation" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => {
        const isLast = i === lines - 1 && lines > 1;
        const width = isLast ? `${lastLineWidth}%` : '100%';
        
        return (
          <Skeleton
            key={i}
            height={lineHeight}
            width={width}
            {...props}
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
 * Skeleton for card content - matches BountyCard, AgentCard layouts
 */
export function SkeletonCard({
  showAvatar = false,
  showHeader = true,
  bodyLines = 2,
  showFooter = false,
  className = '',
  ...props
}: SkeletonCardProps) {
  return (
    <div
      className={`rounded-xl border border-surface-300 bg-surface-50 p-4 sm:p-5 ${className}`}
      role="presentation"
      aria-hidden="true"
      {...props}
    >
      {/* Header with optional avatar */}
      {showHeader && (
        <div className="flex items-start gap-3 mb-3">
          {showAvatar && (
            <Skeleton variant="circle" width={40} height={40} className="shrink-0" />
          )}
          <div className="flex-1 space-y-2">
            <Skeleton height="1.25rem" width="60%" />
            <Skeleton height="0.875rem" width="40%" />
          </div>
        </div>
      )}
      
      {/* Body lines */}
      {bodyLines > 0 && (
        <div className="space-y-2 mb-3">
          <SkeletonText lines={bodyLines} lineHeight="0.875rem" lastLineWidth={75} />
        </div>
      )}
      
      {/* Footer */}
      {showFooter && (
        <div className="flex items-center justify-between pt-3 border-t border-surface-300">
          <Skeleton height="1.5rem" width="5rem" />
          <Skeleton height="1.5rem" width="4rem" />
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
  ...props
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
      {...props}
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
  ...props
}: SkeletonTableRowProps) {
  const defaultWidths = Array.from({ length: columns }, (_, i) => {
    if (i === 0) return 40; // Rank/index column
    if (i === columns - 1) return 80; // Last column
    return 100 / columns;
  });
  
  const widths = columnWidths || defaultWidths;

  return (
    <tr
      className={`border-b border-surface-300 ${className}`}
      role="presentation"
      aria-hidden="true"
      {...props}
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
            />
          </div>
        </td>
      ))}
    </tr>
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
      <div className={`space-y-3 ${className}`} role="status" aria-label="Loading content">
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
      className={`grid ${columnClasses[columns]} gap-[${gap}] ${className}`}
      role="status"
      aria-label="Loading content"
    >
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

// ============================================================================
// Skeleton List (for Bounty List)
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
 * Skeleton list matching BountyCard layout
 */
export function SkeletonList({
  count = 5,
  showTier = true,
  showSkills = true,
  className = '',
}: SkeletonListProps) {
  return (
    <div className={`space-y-4 ${className}`} role="status" aria-label="Loading bounties">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="rounded-xl border border-surface-300 bg-surface-50 p-4 hover:border-solana-purple/30 transition-colors"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <Skeleton height="1.25rem" width="70%" className="mb-2" />
              <Skeleton height="0.875rem" width="50%" />
            </div>
            {showTier && (
              <Skeleton height="1.5rem" width="3rem" className="ml-3 shrink-0" />
            )}
          </div>
          
          {showSkills && (
            <div className="flex flex-wrap gap-2 mb-3">
              {Array.from({ length: 3 }, (_, j) => (
                <Skeleton key={j} height="1.5rem" width="4rem" variant="pill" />
              ))}
            </div>
          )}
          
          <div className="flex items-center justify-between pt-3 border-t border-surface-300">
            <Skeleton height="1.25rem" width="5rem" />
            <Skeleton height="1.25rem" width="4rem" />
          </div>
        </div>
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
    <table className={`w-full text-sm ${className}`} role="status" aria-label="Loading data">
      <thead>
        <tr className="border-b border-gray-700 text-gray-400 text-left text-xs">
          {Array.from({ length: columns }, (_, i) => (
            <th key={i} className="py-2">
              <Skeleton height="0.75rem" width="3rem" />
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
      className={`rounded-xl border border-surface-300 bg-surface-50 ${className}`}
      role="status"
      aria-label="Loading activity"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-surface-300">
        <div className="flex items-center gap-2">
          <Skeleton height="0.5rem" width="0.5rem" variant="circle" />
          <Skeleton height="1rem" width="6rem" />
        </div>
        <Skeleton height="0.75rem" width="4rem" />
      </div>
      
      {/* Items */}
      <div className="divide-y divide-surface-300">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="flex items-start gap-3 p-4">
            <Skeleton height="2rem" width="2rem" className="shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton height="0.875rem" width="80%" />
              <Skeleton height="0.625rem" width="4rem" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default Skeleton;