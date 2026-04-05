import React from 'react';

// Base shimmer animation is defined in index.css as nimate-shimmer

interface SkeletonProps {
  className?: string;
}

// Base skeleton block with shimmer effect
export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={g-gradient-to-r from-forge-800 via-forge-700 to-forge-800 bg-[length:200%_100%] animate-shimmer rounded ${$}{className}}
    />
  );
}

// Bounty Card Skeleton - matches BountyCard layout exactly
export function BountyCardSkeleton() {
  return (
    <div className="relative rounded-xl border border-border bg-forge-900 p-5 overflow-hidden">
      {/* Row 1: Repo + Tier */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="w-5 h-5 rounded-full" />
          <Skeleton className="w-32 h-3" />
        </div>
        <Skeleton className="w-10 h-5 rounded-full" />
      </div>

      {/* Row 2: Title */}
      <div className="mt-3 space-y-2">
        <Skeleton className="w-full h-4" />
        <Skeleton className="w-3/4 h-4" />
      </div>

      {/* Row 3: Language dots */}
      <div className="flex items-center gap-3 mt-3">
        <Skeleton className="w-16 h-4" />
        <Skeleton className="w-14 h-4" />
        <Skeleton className="w-12 h-4" />
      </div>

      {/* Separator */}
      <div className="mt-4 border-t border-border/50" />

      {/* Row 4: Reward + Meta */}
      <div className="flex items-center justify-between mt-3">
        <Skeleton className="w-20 h-5" />
        <div className="flex items-center gap-3">
          <Skeleton className="w-12 h-3" />
          <Skeleton className="w-10 h-3" />
        </div>
      </div>

      {/* Status badge */}
      <Skeleton className="absolute bottom-4 right-5 w-14 h-3" />
    </div>
  );
}

// Leaderboard Row Skeleton
export function LeaderboardRowSkeleton() {
  return (
    <div className="flex items-center px-4 py-3 border-b border-border/30 last:border-b-0">
      <div className="w-[60px] text-center">
        <Skeleton className="w-8 h-4 mx-auto" />
      </div>
      <div className="flex-1 flex items-center gap-3 min-w-0">
        <Skeleton className="w-6 h-6 rounded-full flex-shrink-0" />
        <div className="min-w-0">
          <Skeleton className="w-24 h-4" />
          <div className="flex items-center gap-1 mt-1">
            <Skeleton className="w-2.5 h-2.5 rounded-full" />
            <Skeleton className="w-2.5 h-2.5 rounded-full" />
            <Skeleton className="w-2.5 h-2.5 rounded-full" />
          </div>
        </div>
      </div>
      <div className="w-[100px] text-center">
        <Skeleton className="w-8 h-4 mx-auto" />
      </div>
      <div className="w-[120px] text-right">
        <Skeleton className="w-16 h-4 ml-auto" />
      </div>
      <div className="w-[80px] text-center hidden sm:block">
        <Skeleton className="w-8 h-4 mx-auto" />
      </div>
    </div>
  );
}

// Leaderboard Table Skeleton
export function LeaderboardTableSkeleton({ rows = 7 }: { rows?: number }) {
  return (
    <div className="max-w-4xl mx-auto mt-6 rounded-xl border border-border bg-forge-900 overflow-hidden">
      <div className="flex items-center px-4 py-3 border-b border-border/50 text-xs font-semibold text-text-muted uppercase tracking-wider">
        <div className="w-[60px] text-center">Rank</div>
        <div className="flex-1">User</div>
        <div className="w-[100px] text-center">Bounties</div>
        <div className="w-[120px] text-right">Earned</div>
        <div className="w-[80px] text-center hidden sm:block">Streak</div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <LeaderboardRowSkeleton key={i} />
      ))}
    </div>
  );
}

// Podium Skeleton
export function PodiumSkeleton() {
  return (
    <div className="flex items-end justify-center gap-4 md:gap-8 py-8">
      <div className="flex flex-col items-center w-28 md:w-36">
        <Skeleton className="w-16 h-16 rounded-full mb-2" />
        <Skeleton className="w-20 h-4 mb-1" />
        <Skeleton className="w-12 h-3 mb-2" />
        <div className="w-full h-20 md:h-24 rounded-t-lg bg-forge-800 border border-border border-b-0 flex items-center justify-center">
          <Skeleton className="w-8 h-6" />
        </div>
      </div>
      <div className="flex flex-col items-center w-28 md:w-36">
        <Skeleton className="w-20 h-20 rounded-full mb-2" />
        <Skeleton className="w-24 h-4 mb-1" />
        <Skeleton className="w-14 h-3 mb-2" />
        <div className="w-full h-28 md:h-32 rounded-t-lg bg-forge-800 border border-emerald/30 border-b-0 flex items-center justify-center">
          <Skeleton className="w-10 h-6" />
        </div>
      </div>
      <div className="flex flex-col items-center w-28 md:w-36">
        <Skeleton className="w-14 h-14 rounded-full mb-2" />
        <Skeleton className="w-18 h-4 mb-1" />
        <Skeleton className="w-10 h-3 mb-2" />
        <div className="w-full h-16 md:h-20 rounded-t-lg bg-forge-800 border border-border border-b-0 flex items-center justify-center">
          <Skeleton className="w-6 h-5" />
        </div>
      </div>
    </div>
  );
}

// Bounty Grid Skeleton
export function BountyGridSkeleton({ count = 6, columns = 'default' }: { count?: number; columns?: 'default' | 'featured' }) {
  const gridClass = columns === 'featured'
    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'
    : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5';
  return (
    <div className={gridClass}>
      {Array.from({ length: count }).map((_, i) => (
        <BountyCardSkeleton key={i} />
      ))}
    </div>
  );
}

// Bounty Detail Skeleton
export function BountyDetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Skeleton className="w-28 h-4 mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-border bg-forge-900 p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <Skeleton className="w-4 h-4 rounded-full" />
                  <Skeleton className="w-32 h-3" />
                </div>
                <Skeleton className="w-full h-7" />
              </div>
              <Skeleton className="w-9 h-9 rounded-lg flex-shrink-0" />
            </div>
            <div className="flex items-center gap-3 mb-4">
              <Skeleton className="w-16 h-4" />
              <Skeleton className="w-14 h-4" />
              <Skeleton className="w-12 h-4" />
            </div>
            <div className="space-y-2">
              <Skeleton className="w-full h-4" />
              <Skeleton className="w-full h-4" />
              <Skeleton className="w-3/4 h-4" />
            </div>
            <Skeleton className="w-32 h-4 mt-4" />
          </div>
          <div className="rounded-xl border border-border bg-forge-900 p-6">
            <Skeleton className="w-28 h-5 mb-4" />
            <div className="space-y-2">
              <Skeleton className="w-full h-4" />
              <Skeleton className="w-5/6 h-4" />
            </div>
          </div>
          <div className="rounded-xl border border-border bg-forge-900 p-6">
            <Skeleton className="w-36 h-5 mb-4" />
            <div className="space-y-3">
              <Skeleton className="w-full h-10" />
              <Skeleton className="w-full h-24" />
              <Skeleton className="w-32 h-10" />
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-border bg-emerald-bg/50 p-5">
            <Skeleton className="w-16 h-3 mb-1" />
            <Skeleton className="w-28 h-8" />
          </div>
          <div className="rounded-xl border border-border bg-forge-900 p-5 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="w-16 h-4" />
                <Skeleton className="w-20 h-4" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}