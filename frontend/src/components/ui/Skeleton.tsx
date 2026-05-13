import React from 'react';

/**
 * Base shimmer block — the atomic unit for all skeleton components.
 * Uses the existing `animate-shimmer` animation from tailwind.config.js.
 */
function ShimmerBlock({ className }: { className?: string }) {
  return (
    <div
      className={`rounded bg-gradient-to-r from-forge-900 via-forge-800 to-forge-900 bg-[length:200%_100%] animate-shimmer ${className ?? ''}`}
    />
  );
}

/* ─── Bounty Card Skeleton ─── */

export function BountyCardSkeleton() {
  return (
    <div className="relative rounded-xl border border-border bg-forge-900 p-4 sm:p-5 overflow-hidden">
      {/* Row 1: Repo + Tier */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShimmerBlock className="w-4 h-4 rounded-full" />
          <ShimmerBlock className="w-28 h-4" />
        </div>
        <ShimmerBlock className="w-12 h-5 rounded-full" />
      </div>

      {/* Row 2: Title */}
      <div className="mt-3 space-y-2">
        <ShimmerBlock className="w-full h-4" />
        <ShimmerBlock className="w-3/4 h-4" />
      </div>

      {/* Row 3: Tags */}
      <div className="flex items-center gap-2 mt-3">
        <ShimmerBlock className="w-16 h-5 rounded-full" />
        <ShimmerBlock className="w-20 h-5 rounded-full" />
        <ShimmerBlock className="w-14 h-5 rounded-full" />
      </div>

      {/* Separator */}
      <div className="mt-4 border-t border-border/50" />

      {/* Row 4: Reward + Meta */}
      <div className="flex items-center justify-between mt-3">
        <ShimmerBlock className="w-24 h-5" />
        <div className="flex items-center gap-3">
          <ShimmerBlock className="w-12 h-4" />
          <ShimmerBlock className="w-16 h-4" />
        </div>
      </div>

      {/* Status dot */}
      <ShimmerBlock className="absolute bottom-4 right-4 w-2 h-2 rounded-full" />
    </div>
  );
}

/* ─── Leaderboard Row Skeleton ─── */

export function LeaderboardRowSkeleton({ rank }: { rank?: number }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-lg bg-forge-900 border border-border">
      <span className="w-6 text-center font-mono text-sm text-text-muted">
        {rank ?? '#'}
      </span>
      <ShimmerBlock className="w-8 h-8 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <ShimmerBlock className="w-28 h-4" />
        <ShimmerBlock className="w-20 h-3" />
      </div>
      <ShimmerBlock className="w-16 h-4" />
      <ShimmerBlock className="w-12 h-4" />
    </div>
  );
}

/* ─── Podium Skeleton ─── */

export function PodiumSkeleton() {
  return (
    <div className="flex items-end justify-center gap-4 mb-10 h-52">
      {/* 2nd place */}
      <div className="flex flex-col items-center gap-2 w-28">
        <ShimmerBlock className="w-16 h-16 rounded-full" />
        <ShimmerBlock className="w-20 h-3" />
        <ShimmerBlock className="w-14 h-3" />
        <div className="w-full h-24 rounded-t-lg bg-forge-800 border border-border border-b-0 mt-2" />
      </div>
      {/* 1st place */}
      <div className="flex flex-col items-center gap-2 w-28">
        <ShimmerBlock className="w-20 h-20 rounded-full" />
        <ShimmerBlock className="w-24 h-3" />
        <ShimmerBlock className="w-16 h-3" />
        <div className="w-full h-32 rounded-t-lg bg-forge-800 border border-emerald/30 border-b-0 mt-2" />
      </div>
      {/* 3rd place */}
      <div className="flex flex-col items-center gap-2 w-28">
        <ShimmerBlock className="w-14 h-14 rounded-full" />
        <ShimmerBlock className="w-18 h-3" />
        <ShimmerBlock className="w-12 h-3" />
        <div className="w-full h-16 rounded-t-lg bg-forge-800 border border-border border-b-0 mt-2" />
      </div>
    </div>
  );
}

/* ─── Bounty Detail Skeleton ─── */

export function BountyDetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-6">
      {/* Back link */}
      <ShimmerBlock className="w-32 h-4" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title card */}
          <div className="rounded-xl border border-border bg-forge-900 p-4 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <ShimmerBlock className="w-4 h-4 rounded-full" />
              <ShimmerBlock className="w-36 h-3" />
            </div>
            <ShimmerBlock className="w-full h-6" />
            <ShimmerBlock className="w-2/3 h-6" />
            <div className="flex gap-2 mt-2">
              <ShimmerBlock className="w-16 h-5 rounded-full" />
              <ShimmerBlock className="w-20 h-5 rounded-full" />
            </div>
            <div className="mt-4 space-y-2">
              <ShimmerBlock className="w-full h-3" />
              <ShimmerBlock className="w-full h-3" />
              <ShimmerBlock className="w-3/4 h-3" />
            </div>
          </div>

          {/* Submissions */}
          <div className="rounded-xl border border-border bg-forge-900 p-4 sm:p-6 space-y-3">
            <ShimmerBlock className="w-28 h-5" />
            <ShimmerBlock className="w-full h-3" />
            <ShimmerBlock className="w-2/3 h-3" />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-forge-900 p-4 sm:p-5 space-y-3">
            <ShimmerBlock className="w-20 h-4" />
            <ShimmerBlock className="w-full h-8 rounded-lg" />
            <div className="space-y-2 mt-2">
              <ShimmerBlock className="w-full h-3" />
              <ShimmerBlock className="w-3/4 h-3" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Profile Section Skeleton ─── */

export function ProfileBountyRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-lg bg-forge-900 border border-border">
      <div className="flex-1 space-y-1.5">
        <ShimmerBlock className="w-2/3 h-4" />
        <ShimmerBlock className="w-20 h-3" />
      </div>
      <ShimmerBlock className="w-20 h-4" />
      <ShimmerBlock className="w-14 h-5 rounded-full" />
      <ShimmerBlock className="w-8 h-4" />
    </div>
  );
}

export function ProfileStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-forge-900 p-4 space-y-2">
          <ShimmerBlock className="w-12 h-3" />
          <ShimmerBlock className="w-16 h-6" />
        </div>
      ))}
    </div>
  );
}
