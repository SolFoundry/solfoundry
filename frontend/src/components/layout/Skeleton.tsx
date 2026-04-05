import React from 'react';

interface SkeletonProps {
  className?: string;
  /** Width (Tailwind class like 'w-32' or inline) */
  width?: string;
  /** Height (Tailwind class like 'h-4') */
  height?: string;
  /** Make it circular */
  circle?: boolean;
}

/**
 * Base skeleton with shimmer animation.
 */
export function Skeleton({ className = '', width, height, circle }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`
        animate-pulse bg-forge-800 
        ${circle ? 'rounded-full' : 'rounded-md'}
        ${width ?? ''} ${height ?? 'h-4'}
        ${className}
      `}
      style={{
        background:
          'linear-gradient(90deg, rgb(var(--forge-800)) 25%, rgb(var(--forge-700)) 50%, rgb(var(--forge-800)) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite ease-in-out',
      }}
    />
  );
}

/** Skeleton matching BountyCard layout */
export function BountyCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-forge-900 p-5 space-y-4" aria-hidden="true">
      {/* Title */}
      <Skeleton height="h-5" width="w-3/4" />
      {/* Description lines */}
      <div className="space-y-2">
        <Skeleton height="h-3" width="w-full" />
        <Skeleton height="h-3" width="w-5/6" />
      </div>
      {/* Tags row */}
      <div className="flex gap-2">
        <Skeleton height="h-6" width="w-16" className="rounded-full" />
        <Skeleton height="h-6" width="w-20" className="rounded-full" />
        <Skeleton height="h-6" width="w-14" className="rounded-full" />
      </div>
      {/* Footer: reward + status */}
      <div className="flex justify-between items-center pt-2">
        <Skeleton height="h-4" width="w-24" />
        <Skeleton height="h-4" width="w-16" />
      </div>
    </div>
  );
}

/** Skeleton matching leaderboard row */
export function LeaderboardRowSkeleton() {
  return (
    <div className="flex items-center gap-4 py-3 px-4" aria-hidden="true">
      <Skeleton height="h-4" width="w-6" />
      <Skeleton circle height="h-8" width="w-8" />
      <div className="flex-1 space-y-1">
        <Skeleton height="h-4" width="w-32" />
        <Skeleton height="h-3" width="w-20" />
      </div>
      <Skeleton height="h-4" width="w-16" />
    </div>
  );
}

/** Skeleton for profile header */
export function ProfileSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="flex items-center gap-4">
        <Skeleton circle height="h-16" width="w-16" />
        <div className="space-y-2">
          <Skeleton height="h-5" width="w-40" />
          <Skeleton height="h-3" width="w-24" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} height="h-20" className="rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/** Grid of bounty card skeletons */
export function BountyGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <BountyCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Leaderboard skeleton */
export function LeaderboardSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-forge-900 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <LeaderboardRowSkeleton key={i} />
      ))}
    </div>
  );
}
