import React from 'react';

/* ── Primitive building blocks ──────────────────────────────────────── */

interface SkeletonProps {
  className?: string;
}

/** Base shimmer bar — pass width/height via className */
export function Shimmer({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`rounded bg-gradient-to-r from-forge-900 via-forge-800 to-forge-900 bg-[length:200%_100%] animate-shimmer ${className}`}
    />
  );
}

/** Circular shimmer (avatars) */
export function ShimmerCircle({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`rounded-full bg-gradient-to-r from-forge-900 via-forge-800 to-forge-900 bg-[length:200%_100%] animate-shimmer ${className}`}
    />
  );
}

/* ── Bounty Card Skeleton ───────────────────────────────────────────── */

export function BountyCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-forge-900 p-5 space-y-3">
      {/* Row 1: repo + tier badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShimmerCircle className="w-5 h-5" />
          <Shimmer className="h-3 w-28" />
        </div>
        <Shimmer className="h-5 w-10 rounded-full" />
      </div>
      {/* Row 2: title (two lines) */}
      <div className="space-y-2 pt-1">
        <Shimmer className="h-4 w-full" />
        <Shimmer className="h-4 w-3/4" />
      </div>
      {/* Row 3: skill dots */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5"><ShimmerCircle className="w-2.5 h-2.5" /><Shimmer className="h-3 w-12" /></div>
        <div className="flex items-center gap-1.5"><ShimmerCircle className="w-2.5 h-2.5" /><Shimmer className="h-3 w-10" /></div>
      </div>
      {/* Separator */}
      <div className="border-t border-border/50" />
      {/* Row 4: reward + meta */}
      <div className="flex items-center justify-between pt-1">
        <Shimmer className="h-5 w-24" />
        <div className="flex items-center gap-3">
          <Shimmer className="h-3 w-14" />
          <Shimmer className="h-3 w-14" />
        </div>
      </div>
      {/* Row 5: status */}
      <div className="flex justify-end">
        <Shimmer className="h-3 w-12" />
      </div>
    </div>
  );
}

/* ── Leaderboard Podium Skeleton ────────────────────────────────────── */

function PodiumCardSkeleton({ isGold = false }: { isGold?: boolean }) {
  const size = isGold ? 'w-14 h-14' : 'w-12 h-12';
  const padding = isGold ? 'py-8 px-6' : 'py-6 px-6';
  return (
    <div className={`flex flex-col items-center rounded-xl border border-border bg-forge-900 ${padding} min-w-[140px] space-y-3`}>
      <ShimmerCircle className={size} />
      <Shimmer className="h-4 w-20" />
      <Shimmer className="h-3 w-16" />
      <Shimmer className="h-5 w-16" />
    </div>
  );
}

export function PodiumSkeleton() {
  return (
    <div className="flex items-end justify-center gap-4 md:gap-6 mb-12">
      <PodiumCardSkeleton />
      <PodiumCardSkeleton isGold />
      <PodiumCardSkeleton />
    </div>
  );
}

/* ── Leaderboard Table Row Skeleton ─────────────────────────────────── */

export function LeaderboardRowSkeleton() {
  return (
    <div className="flex items-center px-4 py-3 border-b border-border/30 last:border-b-0">
      <div className="w-[60px] flex justify-center"><Shimmer className="h-4 w-6" /></div>
      <div className="flex-1 flex items-center gap-3">
        <ShimmerCircle className="w-6 h-6" />
        <div className="space-y-1.5">
          <Shimmer className="h-4 w-24" />
          <div className="flex gap-1">
            <ShimmerCircle className="w-2.5 h-2.5" />
            <ShimmerCircle className="w-2.5 h-2.5" />
            <ShimmerCircle className="w-2.5 h-2.5" />
          </div>
        </div>
      </div>
      <div className="w-[100px] flex justify-center"><Shimmer className="h-4 w-8" /></div>
      <div className="w-[120px] flex justify-end"><Shimmer className="h-4 w-16" /></div>
      <div className="w-[80px] hidden sm:flex justify-center"><Shimmer className="h-4 w-10" /></div>
    </div>
  );
}

export function LeaderboardTableSkeleton() {
  return (
    <div className="max-w-4xl mx-auto mt-6 rounded-xl border border-border bg-forge-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center px-4 py-3 border-b border-border/50 text-xs font-semibold text-text-muted uppercase tracking-wider">
        <div className="w-[60px] text-center">Rank</div>
        <div className="flex-1">User</div>
        <div className="w-[100px] text-center">Bounties</div>
        <div className="w-[120px] text-right">Earned</div>
        <div className="w-[80px] text-center hidden sm:block">Streak</div>
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <LeaderboardRowSkeleton key={i} />
      ))}
    </div>
  );
}

/* ── Bounty Detail Skeleton ─────────────────────────────────────────── */

export function BountyDetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Back link */}
      <Shimmer className="h-4 w-32 mb-6" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title card */}
          <div className="rounded-xl border border-border bg-forge-900 p-6 space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <ShimmerCircle className="w-4 h-4" />
              <Shimmer className="h-3 w-32" />
            </div>
            <Shimmer className="h-6 w-3/4" />
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5"><ShimmerCircle className="w-2.5 h-2.5" /><Shimmer className="h-3 w-14" /></div>
              <div className="flex items-center gap-1.5"><ShimmerCircle className="w-2.5 h-2.5" /><Shimmer className="h-3 w-10" /></div>
            </div>
            <div className="space-y-2 pt-2">
              <Shimmer className="h-3 w-full" />
              <Shimmer className="h-3 w-full" />
              <Shimmer className="h-3 w-5/6" />
              <Shimmer className="h-3 w-2/3" />
            </div>
          </div>
          {/* Requirements card */}
          <div className="rounded-xl border border-border bg-forge-900 p-6 space-y-3">
            <Shimmer className="h-5 w-32" />
            <Shimmer className="h-3 w-full" />
            <Shimmer className="h-3 w-4/5" />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Reward card */}
          <div className="rounded-xl border border-emerald-border bg-emerald-bg/50 p-5 space-y-2">
            <Shimmer className="h-3 w-12" />
            <Shimmer className="h-8 w-32" />
          </div>
          {/* Info card */}
          <div className="rounded-xl border border-border bg-forge-900 p-5 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Shimmer className="h-3 w-16" />
                <Shimmer className="h-3 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Profile Dashboard Skeleton ─────────────────────────────────────── */

export function ProfileSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="rounded-xl border border-border bg-forge-900 p-6 mb-6">
        <div className="flex items-start gap-5">
          <ShimmerCircle className="w-16 h-16" />
          <div className="flex-1 space-y-2">
            <Shimmer className="h-6 w-40" />
            <Shimmer className="h-4 w-56" />
          </div>
        </div>
        {/* Tab bar */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-forge-800 mt-6 w-fit">
          {Array.from({ length: 4 }).map((_, i) => (
            <Shimmer key={i} className="h-8 w-24 rounded-md" />
          ))}
        </div>
      </div>
      {/* Tab content — bounty list rows */}
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 rounded-lg bg-forge-900 border border-border">
            <div className="flex-1 space-y-1.5">
              <Shimmer className="h-4 w-3/4" />
              <Shimmer className="h-3 w-20" />
            </div>
            <Shimmer className="h-4 w-20" />
            <Shimmer className="h-5 w-16 rounded-full" />
            <Shimmer className="h-3 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Activity Feed Skeleton ─────────────────────────────────────────── */

export function ActivityFeedSkeleton() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-lg">
          <ShimmerCircle className="w-6 h-6" />
          <div className="flex-1">
            <Shimmer className="h-4 w-3/4" />
          </div>
          <Shimmer className="h-3 w-10" />
        </div>
      ))}
    </div>
  );
}
