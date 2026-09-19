import React from 'react';

interface SkeletonProps {
  className?: string;
}

/**
 * Base shimmer block. All skeletons share this so loading states
 * look and feel identical across the app.
 */
export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={`rounded bg-gradient-to-r from-forge-900 via-forge-800 to-forge-900 bg-[length:200%_100%] animate-shimmer ${className}`}
    />
  );
}

/** Shape-matched placeholder for <BountyCard>. */
export function BountyCardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading bounty"
      className="rounded-xl border border-border bg-forge-900 p-5 overflow-hidden"
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-5 w-12 !rounded-full" />
      </div>
      <div className="mt-3 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="mt-4 border-t border-border/50" />
      <div className="mt-3 flex items-center justify-between">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}

/** Shape-matched placeholder for the bounty detail page. */
export function BountyDetailSkeleton() {
  return (
    <div role="status" aria-label="Loading bounty details" className="max-w-4xl mx-auto px-4 py-8">
      <Skeleton className="h-4 w-24" />
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <div className="rounded-xl border border-border bg-forge-900 p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-forge-900 p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
          <Skeleton className="h-10 w-full !rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/** Shape-matched placeholder for leaderboard rows. */
export function LeaderboardSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading leaderboard" className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-xl border border-border bg-forge-900 px-4 py-3"
        >
          <Skeleton className="h-5 w-8" />
          <Skeleton className="h-9 w-9 !rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
    </div>
  );
}

/** Shape-matched placeholder for profile sections. */
export function ProfileSectionSkeleton() {
  return (
    <div role="status" aria-label="Loading profile" className="space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 !rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-forge-900 p-4 space-y-2">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      <Skeleton className="h-24 w-full !rounded-xl" />
    </div>
  );
}

export default Skeleton;
