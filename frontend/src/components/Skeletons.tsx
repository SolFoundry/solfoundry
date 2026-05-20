import React from 'react';

/** Base shimmer pulse */
function SkeletonBox({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-forge-800 ${className ?? ''}`}
    />
  );
}

/** Matches BountyCard layout (used in BountyGrid) */
export function BountyCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-forge-900 p-5">
      {/* Row 1: avatar + tier badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SkeletonBox className="w-5 h-5 rounded-full" />
          <SkeletonBox className="w-32 h-3.5" />
        </div>
        <SkeletonBox className="w-10 h-5 rounded-full" />
      </div>

      {/* Row 2: title */}
      <SkeletonBox className="mt-3 h-5 w-4/5" />
      <SkeletonBox className="mt-2 h-5 w-2/3" />

      {/* Row 3: skill dots */}
      <div className="flex items-center gap-3 mt-3">
        <div className="flex items-center gap-1.5">
          <SkeletonBox className="w-2.5 h-2.5 rounded-full" />
          <SkeletonBox className="w-14 h-3" />
        </div>
        <div className="flex items-center gap-1.5">
          <SkeletonBox className="w-2.5 h-2.5 rounded-full" />
          <SkeletonBox className="w-14 h-3" />
        </div>
      </div>

      {/* Separator */}
      <div className="mt-4 border-t border-border/50" />

      {/* Row 4: reward + meta */}
      <div className="flex items-center justify-between mt-3">
        <SkeletonBox className="w-28 h-6" />
        <div className="flex items-center gap-3">
          <SkeletonBox className="w-16 h-3.5" />
          <SkeletonBox className="w-16 h-3.5" />
        </div>
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

/** Matches LeaderboardTable row layout */
export function LeaderboardRowSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="max-w-4xl mx-auto mt-6 rounded-xl border border-border bg-forge-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center px-4 py-3 border-b border-border/50">
        <div className="w-[60px]">
          <SkeletonBox className="w-8 h-3 mx-auto" />
        </div>
        <div className="flex-1">
          <SkeletonBox className="w-10 h-3" />
        </div>
        <div className="w-[100px] text-center">
          <SkeletonBox className="w-14 h-3 mx-auto" />
        </div>
        <div className="w-[120px] text-right">
          <SkeletonBox className="w-16 h-3 ml-auto" />
        </div>
        <div className="w-[80px] text-center hidden sm:block">
          <SkeletonBox className="w-8 h-3 mx-auto" />
        </div>
      </div>

      {/* Rows */}
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center px-4 py-3 border-b border-border/30 last:border-b-0">
          <div className="w-[60px] text-center">
            <SkeletonBox className="w-6 h-4 mx-auto" />
          </div>
          <div className="flex-1 flex items-center gap-3">
            <SkeletonBox className="w-6 h-6 rounded-full" />
            <div>
              <SkeletonBox className="w-24 h-4" />
              <div className="flex items-center gap-1 mt-1">
                <SkeletonBox className="w-2.5 h-2.5 rounded-full" />
                <SkeletonBox className="w-2.5 h-2.5 rounded-full" />
                <SkeletonBox className="w-2.5 h-2.5 rounded-full" />
              </div>
            </div>
          </div>
          <div className="w-[100px] text-center">
            <SkeletonBox className="w-8 h-4 mx-auto" />
          </div>
          <div className="w-[120px] text-right">
            <SkeletonBox className="w-16 h-4 ml-auto" />
          </div>
          <div className="w-[80px] text-center hidden sm:block">
            <SkeletonBox className="w-10 h-4 mx-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Matches PodiumCards layout (3 cards) */
export function PodiumSkeleton() {
  return (
    <div className="flex items-end justify-center gap-4 mb-6">
      {[160, 200, 140].map((h, i) => (
        <div key={i} className="flex flex-col items-center gap-2" style={{ width: '140px' }}>
          <SkeletonBox className="w-12 h-12 rounded-full mx-auto" />
          <SkeletonBox className="w-20 h-4" />
          <SkeletonBox className="w-16 h-3" />
          <SkeletonBox className="w-full rounded-lg" style={{ height: `${h * 0.4}px` }} />
        </div>
      ))}
    </div>
  );
}

/** Matches ProfileDashboard header */
export function ProfileHeaderSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-forge-900 p-6 mb-6">
      <div className="flex items-start gap-5">
        <SkeletonBox className="w-16 h-16 rounded-full border-2 border-border" />
        <div className="flex-1">
          <SkeletonBox className="w-40 h-7" />
          <SkeletonBox className="mt-2 w-52 h-4" />
        </div>
      </div>
      {/* Tab bar */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-forge-800 mt-6 w-fit">
        {[80, 100, 60, 60].map((w, i) => (
          <SkeletonBox key={i} className="rounded-md" style={{ width: `${w}px`, height: '32px' }} />
        ))}
      </div>
    </div>
  );
}

/** Matches MyBountiesTab list rows */
export function ProfileBountyListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 rounded-lg bg-forge-900 border border-border">
          <div className="flex-1 min-w-0">
            <SkeletonBox className="w-3/4 h-4" />
            <SkeletonBox className="mt-1.5 w-20 h-3" />
          </div>
          <SkeletonBox className="w-24 h-4" />
          <SkeletonBox className="w-16 h-5 rounded-full" />
          <SkeletonBox className="w-12 h-3.5" />
        </div>
      ))}
    </div>
  );
}

/** Matches BountyDetail layout */
export function BountyDetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
      {/* Title area */}
      <SkeletonBox className="w-2/3 h-7" />
      <SkeletonBox className="w-1/2 h-4" />

      {/* Main card */}
      <div className="rounded-xl border border-border bg-forge-900 p-6 space-y-4">
        <SkeletonBox className="w-40 h-8" />
        <SkeletonBox className="w-full h-4" />
        <SkeletonBox className="w-full h-4" />
        <SkeletonBox className="w-3/4 h-4" />
        <div className="border-t border-border/50 pt-4">
          <SkeletonBox className="w-32 h-4" />
          <div className="flex gap-2 mt-2">
            <SkeletonBox className="w-20 h-6 rounded-full" />
            <SkeletonBox className="w-20 h-6 rounded-full" />
          </div>
        </div>
      </div>

      {/* Submission area */}
      <div className="rounded-xl border border-border bg-forge-900 p-6">
        <SkeletonBox className="w-24 h-5" />
        <div className="mt-4 space-y-3">
          <SkeletonBox className="w-full h-10 rounded-lg" />
          <SkeletonBox className="w-full h-24 rounded-lg" />
          <SkeletonBox className="w-full h-10 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
