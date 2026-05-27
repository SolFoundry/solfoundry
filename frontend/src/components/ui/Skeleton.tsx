import React from 'react';

interface SkeletonProps {
  className?: string;
}

/** Base skeleton block with shimmer animation */
export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`rounded-lg bg-gradient-to-r from-forge-900 via-forge-800 to-forge-900 bg-[length:200%_100%] animate-shimmer ${className}`}
    />
  );
}

/** Bounty card skeleton — matches BountyCard layout */
export function BountyCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-forge-900 p-5 overflow-hidden">
      {/* Row 1: Repo + Tier */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-5 w-8 rounded-full" />
      </div>
      {/* Row 2: Title */}
      <div className="mt-3 space-y-2">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-3/4" />
      </div>
      {/* Row 3: Skills */}
      <div className="flex items-center gap-3 mt-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
      {/* Separator */}
      <div className="mt-4 border-t border-border/50" />
      {/* Row 4: Reward + Meta */}
      <div className="flex items-center justify-between mt-3">
        <Skeleton className="h-6 w-24" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  );
}

/** Leaderboard row skeleton */
export function LeaderboardRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-border/50">
      <Skeleton className="h-6 w-6 rounded-full" />
      <Skeleton className="h-8 w-8 rounded-full" />
      <div className="flex-1 space-y-1">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="text-right space-y-1">
        <Skeleton className="h-4 w-16 ml-auto" />
        <Skeleton className="h-3 w-12 ml-auto" />
      </div>
    </div>
  );
}

/** Podium skeleton for top 3 */
export function PodiumSkeleton() {
  return (
    <div className="flex items-end justify-center gap-4 mb-10">
      {/* 2nd place */}
      <div className="flex flex-col items-center gap-2">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-20 w-28 rounded-t-xl" />
      </div>
      {/* 1st place */}
      <div className="flex flex-col items-center gap-2">
        <Skeleton className="h-12 w-12 rounded-full" />
        <Skeleton className="h-28 w-32 rounded-t-xl" />
      </div>
      {/* 3rd place */}
      <div className="flex flex-col items-center gap-2">
        <Skeleton className="h-9 w-9 rounded-full" />
        <Skeleton className="h-16 w-28 rounded-t-xl" />
      </div>
    </div>
  );
}

/** Profile page skeleton */
export function ProfileSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      {/* Profile header */}
      <div className="flex items-center gap-6 mb-10">
        <Skeleton className="h-20 w-20 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </div>
      </div>
      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-forge-900 p-4">
            <Skeleton className="h-3 w-16 mb-2" />
            <Skeleton className="h-7 w-20" />
          </div>
        ))}
      </div>
      {/* Recent activity */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-32 mb-4" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-forge-900 p-4">
            <Skeleton className="h-4 w-4 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
