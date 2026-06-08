import React from "react";

/**
 * Base shimmer skeleton block.
 * Used as a building block for page-specific skeleton layouts.
 */
interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-shimmer bg-gradient-to-r from-forge-800 via-forge-700 to-forge-800 bg-[length:200%_100%] rounded ${className}`}
    />
  );
}

/**
 * BountyCardSkeleton — matches the shape of BountyCard layout
 */
export function BountyCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-forge-900 p-5 space-y-4">
      {/* Row 1: Repo + Tier */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="w-5 h-5 rounded-full" />
          <Skeleton className="w-24 h-3" />
        </div>
        <Skeleton className="w-10 h-5 rounded-full" />
      </div>
      {/* Title */}
      <Skeleton className="w-3/4 h-5" />
      <Skeleton className="w-1/2 h-5" />
      {/* Language dots */}
      <div className="flex gap-3">
        <Skeleton className="w-16 h-3" />
        <Skeleton className="w-12 h-3" />
        <Skeleton className="w-14 h-3" />
      </div>
      {/* Separator */}
      <div className="border-t border-border/50" />
      {/* Reward + Meta */}
      <div className="flex items-center justify-between">
        <Skeleton className="w-20 h-6" />
        <div className="flex gap-3">
          <Skeleton className="w-12 h-3" />
          <Skeleton className="w-16 h-3" />
        </div>
      </div>
    </div>
  );
}

/**
 * Grid of bounty card skeletons
 */
export function BountyGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <BountyCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * LeaderboardTableSkeleton — matches LeaderboardTable layout
 */
export function LeaderboardSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-2 text-xs text-text-muted">
        <Skeleton className="w-6 h-3" />
        <Skeleton className="w-24 h-3 flex-1" />
        <Skeleton className="w-16 h-3" />
        <Skeleton className="w-12 h-3" />
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 rounded-lg bg-forge-900/50">
          <Skeleton className="w-6 h-4" />
          <Skeleton className="w-8 h-8 rounded-full" />
          <Skeleton className="w-28 h-4 flex-1" />
          <Skeleton className="w-16 h-4" />
          <Skeleton className="w-10 h-4" />
        </div>
      ))}
    </div>
  );
}

/**
 * ProfileSkeleton — matches ProfileDashboard layout
 */
export function ProfileSkeleton() {
  return (
    <div className="space-y-6 px-4 py-8 max-w-4xl mx-auto">
      {/* Avatar + Name */}
      <div className="flex items-center gap-4">
        <Skeleton className="w-16 h-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="w-40 h-6" />
          <Skeleton className="w-24 h-4" />
        </div>
      </div>
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
      {/* Activity section */}
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}
