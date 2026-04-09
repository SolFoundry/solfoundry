import React from 'react';
import { Skeleton, CircleSkeleton } from './Skeleton';

/**
 * Skeleton loader for BountyCard component.
 * Matches the exact layout of BountyCard with shimmer animation.
 */
export function BountyCardSkeleton() {
  return (
    <div 
      className="relative rounded-xl border border-border bg-forge-900 p-5 overflow-hidden"
      aria-busy="true"
      aria-label="Loading bounty card"
    >
      {/* Row 1: Repo + Tier */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <CircleSkeleton size="1.25rem" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>

      {/* Row 2: Title */}
      <div className="mt-3 space-y-2">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-3/4" />
      </div>

      {/* Row 3: Language dots */}
      <div className="flex items-center gap-3 mt-3">
        <div className="flex items-center gap-1.5">
          <Skeleton className="w-2.5 h-2.5 rounded-full" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="flex items-center gap-1.5">
          <Skeleton className="w-2.5 h-2.5 rounded-full" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>

      {/* Separator */}
      <div className="mt-4 border-t border-border/50" />

      {/* Row 4: Reward + Meta */}
      <div className="flex items-center justify-between mt-3">
        <Skeleton className="h-6 w-24" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-14" />
        </div>
      </div>

      {/* Status badge placeholder */}
      <div className="absolute bottom-4 right-5">
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}

/**
 * Grid of skeleton cards for loading states
 */
export function BountyCardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div 
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
      role="status"
      aria-label="Loading bounties"
    >
      {Array.from({ length: count }).map((_, i) => (
        <BountyCardSkeleton key={i} />
      ))}
    </div>
  );
}
