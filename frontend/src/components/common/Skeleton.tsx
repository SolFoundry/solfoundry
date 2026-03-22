import React from 'react';

// ============================================================================
// Types
// ============================================================================

export interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  variant?: 'default' | 'circle' | 'pill';
  animation?: 'shimmer' | 'pulse' | 'none';
}

export interface SkeletonTextProps {
  lines?: number;
  lineHeight?: string | number;
  lastLineWidth?: number;
  className?: string;
  animation?: 'shimmer' | 'pulse' | 'none';
}

export interface SkeletonCardProps {
  showAvatar?: boolean;
  showHeader?: boolean;
  bodyLines?: number;
  showFooter?: boolean;
  className?: string;
}

export interface SkeletonAvatarProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export interface SkeletonTableRowProps {
  columns?: number;
  showAvatar?: boolean;
  columnWidths?: number[];
  className?: string;
}

export interface SkeletonGridProps {
  count?: number;
  columns?: 1 | 2 | 3 | 4;
  variant?: 'card' | 'list';
  showAvatar?: boolean;
  className?: string;
}

export interface SkeletonListProps {
  count?: number;
  showTier?: boolean;
  showSkills?: boolean;
  className?: string;
}

export interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  showAvatar?: boolean;
  className?: string;
}

export interface SkeletonActivityFeedProps {
  count?: number;
  className?: string;
}

// ============================================================================
// Base Skeleton
// ============================================================================

const VARIANT_CLASSES: Record<string, string> = {
  default: 'rounded-lg',
  circle: 'rounded-full',
  pill: 'rounded-full',
};

const ANIMATION_CLASSES: Record<string, string> = {
  shimmer: 'skeleton-shimmer',
  pulse: 'skeleton-pulse bg-surface-200',
  none: 'bg-surface-200',
};

export function Skeleton({
  className = '',
  width,
  height,
  variant = 'default',
  animation = 'shimmer',
}: SkeletonProps) {
  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={`${ANIMATION_CLASSES[animation]} ${VARIANT_CLASSES[variant]} ${className}`}
      style={style}
      role="presentation"
      aria-hidden="true"
    />
  );
}

// ============================================================================
// Skeleton Text
// ============================================================================

export function SkeletonText({
  lines = 1,
  lineHeight = '0.875rem',
  lastLineWidth = 70,
  className = '',
  animation = 'shimmer',
}: SkeletonTextProps) {
  return (
    <div className={`flex flex-col gap-2 ${className}`} role="presentation" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => {
        const isLast = i === lines - 1 && lines > 1;
        return (
          <Skeleton
            key={i}
            height={lineHeight}
            width={isLast ? `${lastLineWidth}%` : '100%'}
            animation={animation}
          />
        );
      })}
    </div>
  );
}

// ============================================================================
// Skeleton Card
// ============================================================================

export function SkeletonCard({
  showAvatar = false,
  showHeader = true,
  bodyLines = 2,
  showFooter = false,
  className = '',
}: SkeletonCardProps) {
  return (
    <div
      className={`rounded-xl border border-surface-300 bg-surface-50 p-4 sm:p-5 ${className}`}
      role="presentation"
      aria-hidden="true"
    >
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

      {bodyLines > 0 && (
        <div className="mb-3">
          <SkeletonText lines={bodyLines} lastLineWidth={75} />
        </div>
      )}

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

const AVATAR_SIZES: Record<string, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
};

export function SkeletonAvatar({
  size = 'md',
  className = '',
}: SkeletonAvatarProps) {
  const px = AVATAR_SIZES[size];
  return <Skeleton variant="circle" width={px} height={px} className={className} />;
}

// ============================================================================
// Skeleton Table Row
// ============================================================================

export function SkeletonTableRow({
  columns = 4,
  showAvatar = false,
  columnWidths,
  className = '',
}: SkeletonTableRowProps) {
  const widths = columnWidths ?? Array.from({ length: columns }, (_, i) => {
    if (i === 0) return 40;
    if (i === columns - 1) return 80;
    return 100 / columns;
  });

  return (
    <tr className={`border-b border-surface-300 ${className}`} role="presentation" aria-hidden="true">
      {Array.from({ length: columns }, (_, i) => (
        <td key={i} className="py-3 px-2">
          <div className="flex items-center gap-2">
            {showAvatar && i === 1 && <SkeletonAvatar size="sm" />}
            <Skeleton height="1rem" width={`${widths[i]}%`} />
          </div>
        </td>
      ))}
    </tr>
  );
}

// ============================================================================
// Skeleton Grid
// ============================================================================

const COLUMN_CLASSES: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
};

export function SkeletonGrid({
  count = 6,
  columns = 3,
  variant = 'card',
  showAvatar = false,
  className = '',
}: SkeletonGridProps) {
  if (variant === 'list') {
    return (
      <div className={`space-y-3 ${className}`} role="status" aria-label="Loading content">
        {Array.from({ length: count }, (_, i) => (
          <SkeletonCard key={i} showAvatar={showAvatar} bodyLines={2} showFooter />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`grid ${COLUMN_CLASSES[columns]} gap-4 ${className}`}
      role="status"
      aria-label="Loading content"
    >
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} showAvatar={showAvatar} bodyLines={2} showFooter />
      ))}
    </div>
  );
}

// ============================================================================
// Skeleton List (Bounty List)
// ============================================================================

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
          className="rounded-xl border border-surface-300 bg-surface-50 p-4"
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

export function SkeletonTable({
  rows = 10,
  columns = 5,
  showAvatar = false,
  className = '',
}: SkeletonTableProps) {
  return (
    <table className={`w-full text-sm ${className}`} role="status" aria-label="Loading data">
      <thead>
        <tr className="border-b border-gray-700 text-left text-xs">
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
      <div className="flex items-center justify-between p-5 border-b border-surface-300">
        <div className="flex items-center gap-2">
          <Skeleton height={8} width={8} variant="circle" />
          <Skeleton height="1rem" width="6rem" />
        </div>
        <Skeleton height="0.75rem" width="4rem" />
      </div>

      <div className="divide-y divide-surface-300">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="flex items-start gap-3 p-4">
            <Skeleton height={32} width={32} className="shrink-0 rounded-lg" />
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
// Skeleton Dashboard (ContributorDashboard layout)
// ============================================================================

export interface SkeletonDashboardProps {
  className?: string;
}

function SkeletonStatCard() {
  return (
    <div className="bg-surface-100 rounded-xl p-4 sm:p-5 border border-surface-300">
      <div className="flex items-center justify-between mb-3">
        <Skeleton height="0.75rem" width="5rem" />
        <Skeleton height={20} width={20} variant="circle" />
      </div>
      <Skeleton height="1.75rem" width="60%" className="mb-1" />
      <Skeleton height="0.625rem" width="40%" />
    </div>
  );
}

export function SkeletonDashboard({ className = '' }: SkeletonDashboardProps) {
  return (
    <div className={`min-h-screen bg-surface text-white p-4 sm:p-6 lg:p-8 ${className}`} role="status" aria-label="Loading dashboard" aria-live="polite">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Skeleton height="2rem" width="16rem" className="mb-2" />
          <Skeleton height="0.875rem" width="22rem" />
        </div>

        {/* 4 Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }, (_, i) => <SkeletonStatCard key={i} />)}
        </div>

        {/* Quick Actions */}
        <div className="flex gap-3 mb-6">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} height="2.5rem" width="8rem" variant="pill" />
          ))}
        </div>

        {/* Two-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active Bounties */}
          <div className="bg-surface-100 rounded-xl p-5 border border-surface-300">
            <div className="flex items-center justify-between mb-4">
              <Skeleton height="1rem" width="7rem" />
              <Skeleton height="0.75rem" width="3rem" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-surface-50">
                  <div className="flex-1">
                    <Skeleton height="0.875rem" width="70%" className="mb-2" />
                    <Skeleton height="0.5rem" width="100%" variant="pill" />
                  </div>
                  <Skeleton height="1.5rem" width="4rem" />
                </div>
              ))}
            </div>
          </div>

          {/* Activity Feed */}
          <div className="rounded-xl border border-surface-300 bg-surface-50">
            <div className="flex items-center justify-between p-5 border-b border-surface-300">
              <Skeleton height="1rem" width="6rem" />
              <Skeleton height="0.75rem" width="4rem" />
            </div>
            <div className="divide-y divide-surface-300">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="flex items-start gap-3 p-4">
                  <Skeleton height={32} width={32} className="shrink-0 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton height="0.875rem" width="80%" />
                    <Skeleton height="0.625rem" width="4rem" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Skeleton Creator Dashboard
// ============================================================================

export interface SkeletonCreatorDashboardProps {
  className?: string;
}

export function SkeletonCreatorDashboard({ className = '' }: SkeletonCreatorDashboardProps) {
  return (
    <div className={`min-h-screen bg-surface text-white p-4 sm:p-6 lg:p-8 ${className}`} role="status" aria-label="Loading creator dashboard">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <Skeleton height="2rem" width="14rem" className="mb-2" />
          <Skeleton height="0.875rem" width="26rem" />
        </div>

        {/* 3 Escrow stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="bg-surface-100 rounded-xl p-5 border border-surface-300 border-l-4 border-l-surface-400">
              <Skeleton height="0.75rem" width="8rem" className="mb-3" />
              <Skeleton height="2rem" width="10rem" />
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div className="bg-surface-100 p-2 rounded-lg border border-surface-300">
          <div className="flex gap-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} height="2.25rem" width={i === 0 ? '5rem' : '4rem'} variant="pill" />
            ))}
          </div>
        </div>

        {/* Bounty list */}
        <div className="space-y-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="rounded-xl border border-surface-300 bg-surface-50 p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <Skeleton height="1.25rem" width="70%" className="mb-2" />
                  <Skeleton height="0.875rem" width="50%" />
                </div>
                <Skeleton height="1.5rem" width="3rem" className="ml-3 shrink-0" />
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {Array.from({ length: 3 }, (_, j) => (
                  <Skeleton key={j} height="1.5rem" width="4rem" variant="pill" />
                ))}
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-surface-300">
                <Skeleton height="1.25rem" width="5rem" />
                <Skeleton height="1.25rem" width="4rem" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Skeleton Profile (ContributorProfile layout)
// ============================================================================

export interface SkeletonProfileProps {
  className?: string;
}

export function SkeletonProfile({ className = '' }: SkeletonProfileProps) {
  return (
    <div className={`bg-gray-900 rounded-lg p-4 sm:p-6 space-y-6 ${className}`} role="status" aria-label="Loading profile">
      {/* Profile Header: avatar + name + wallet */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <SkeletonAvatar size="xl" className="mx-auto sm:mx-0" />
        <div className="flex-1 text-center sm:text-left space-y-2">
          <Skeleton height="1.75rem" width="10rem" className="mx-auto sm:mx-0" />
          <Skeleton height="0.875rem" width="8rem" className="mx-auto sm:mx-0" />
        </div>
        <Skeleton height="2rem" width="4.5rem" variant="pill" />
      </div>

      {/* 3 Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="bg-gray-800 rounded-lg p-3 sm:p-4">
            <Skeleton height="0.75rem" width="5rem" className="mb-2" />
            <Skeleton height="1.5rem" width="6rem" />
          </div>
        ))}
      </div>

      {/* Recent activity bar */}
      <div className="bg-gray-800/50 rounded-lg p-3 flex items-center justify-between">
        <Skeleton height="0.75rem" width="6rem" />
        <Skeleton height="0.75rem" width="4rem" />
      </div>

      {/* Badge grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="bg-gray-800/50 rounded-xl p-3 flex flex-col items-center gap-2">
            <Skeleton height={40} width={40} variant="circle" />
            <Skeleton height="0.625rem" width="3.5rem" />
          </div>
        ))}
      </div>

      {/* CTA button */}
      <Skeleton height="3rem" width="100%" />
    </div>
  );
}

// ============================================================================
// Skeleton Leaderboard (full leaderboard loading state)
// ============================================================================

export interface SkeletonLeaderboardProps {
  className?: string;
}

export function SkeletonLeaderboard({ className = '' }: SkeletonLeaderboardProps) {
  return (
    <div className={`p-6 max-w-5xl mx-auto space-y-6 ${className}`} role="status" aria-label="Loading leaderboard" data-testid="leaderboard-page">
      {/* Title */}
      <Skeleton height="2rem" width="16rem" />

      {/* Controls: search + time range + sort */}
      <div className="flex flex-wrap gap-3 items-center">
        <Skeleton height="2.5rem" width="16rem" />
        <div className="flex gap-1">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} height="2rem" width="4rem" variant="pill" />
          ))}
        </div>
        <Skeleton height="2.5rem" width="6rem" />
      </div>

      {/* Table */}
      <SkeletonTable rows={10} columns={6} showAvatar />
    </div>
  );
}

// ============================================================================
// Default export
// ============================================================================

export default Skeleton;
