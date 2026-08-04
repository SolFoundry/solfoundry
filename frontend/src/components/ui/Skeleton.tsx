import React from 'react';

// ─── Base Skeleton Block ─────────────────────────────────────────────────────
interface SkeletonBlockProps {
  className?: string;
}

export function SkeletonBlock({ className = '' }: SkeletonBlockProps) {
  return (
    <div
      className={`rounded-lg bg-forge-800 animate-shimmer bg-gradient-to-r from-forge-800 via-forge-700 to-forge-800 bg-[length:200%_100%] ${className}`}
    />
  );
}

// ─── Text Line Skeleton ──────────────────────────────────────────────────────
interface SkeletonTextProps {
  width?: string;
  className?: string;
}

export function SkeletonText({ width = '100%', className = '' }: SkeletonTextProps) {
  return (
    <SkeletonBlock className={`h-3 ${className}`} style={{ width }} />
  );
}

// ─── Avatar Circle Skeleton ──────────────────────────────────────────────────
interface SkeletonAvatarProps {
  size?: string;
  className?: string;
}

export function SkeletonAvatar({ size = 'w-10 h-10', className = '' }: SkeletonAvatarProps) {
  return (
    <SkeletonBlock className={`rounded-full ${size} ${className}`} />
  );
}

// ─── Bounty Card Skeleton ────────────────────────────────────────────────────
export function BountyCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-forge-900 p-5 overflow-hidden">
      {/* Row 1: Repo + Tier */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SkeletonBlock className="w-5 h-5 rounded-full" />
          <SkeletonText width="120px" />
        </div>
        <SkeletonBlock className="w-10 h-5 rounded-full" />
      </div>

      {/* Row 2: Title (2 lines) */}
      <div className="mt-3 space-y-2">
        <SkeletonText width="90%" />
        <SkeletonText width="60%" />
      </div>

      {/* Row 3: Language dots */}
      <div className="flex items-center gap-3 mt-3">
        <SkeletonText width="50px" />
        <SkeletonText width="60px" />
      </div>

      {/* Separator */}
      <div className="mt-4 border-t border-border/50" />

      {/* Row 4: Reward + Meta */}
      <div className="flex items-center justify-between mt-3">
        <SkeletonBlock className="w-24 h-6 rounded" />
        <div className="flex items-center gap-3">
          <SkeletonText width="50px" />
          <SkeletonText width="60px" />
        </div>
      </div>
    </div>
  );
}

// ─── Leaderboard Row Skeleton ────────────────────────────────────────────────
export function LeaderboardRowSkeleton() {
  return (
    <div className="flex items-center px-4 py-3 border-b border-border/30 last:border-b-0">
      <div className="w-[60px] flex justify-center">
        <SkeletonText width="20px" className="mx-auto" />
      </div>
      <div className="flex-1 flex items-center gap-3">
        <SkeletonAvatar size="w-8 h-8" />
        <SkeletonText width="100px" />
      </div>
      <div className="w-[100px] flex justify-center">
        <SkeletonText width="30px" className="mx-auto" />
      </div>
      <div className="w-[120px] flex justify-end">
        <SkeletonText width="60px" />
      </div>
      <div className="w-[80px] flex justify-center hidden sm:flex">
        <SkeletonText width="24px" className="mx-auto" />
      </div>
    </div>
  );
}

// ─── Podium Card Skeleton ────────────────────────────────────────────────────
export function PodiumCardSkeleton({ isGold = false }: { isGold?: boolean }) {
  const padding = isGold ? 'py-8 px-6' : 'py-6 px-6';
  const avatarSize = isGold ? 'w-14 h-14' : 'w-12 h-12';
  return (
    <div className={`relative flex flex-col items-center rounded-xl border border-border bg-forge-900 ${padding} min-w-[140px]`}>
      <SkeletonBlock className="w-6 h-6 rounded-full absolute -top-3" />
      <SkeletonAvatar size={avatarSize} />
      <SkeletonText width="80px" className="mt-3" />
      <SkeletonText width="60px" className="mt-1" />
      <SkeletonText width="70px" className="mt-1" />
    </div>
  );
}

// ─── Profile Dashboard Skeleton ──────────────────────────────────────────────
export function ProfileDashboardSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header card */}
      <div className="rounded-xl border border-border bg-forge-900 p-6 mb-6">
        <div className="flex items-start gap-5">
          <SkeletonAvatar size="w-16 h-16" />
          <div className="flex-1 space-y-2">
            <SkeletonText width="150px" className="h-5" />
            <SkeletonText width="200px" />
          </div>
        </div>
        {/* Tab bar */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-forge-800 mt-6 w-fit">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonBlock key={i} className="h-8 w-24 rounded-md" />
          ))}
        </div>
      </div>

      {/* Tab content skeleton */}
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 rounded-lg bg-forge-900 border border-border">
            <div className="flex-1 space-y-1">
              <SkeletonText width="70%" />
              <SkeletonText width="40%" />
            </div>
            <SkeletonBlock className="w-20 h-6 rounded" />
            <SkeletonBlock className="w-16 h-6 rounded-full" />
            <SkeletonText width="30px" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Bounty Detail Skeleton ────────────────────────────────────────────────
export function BountyDetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Back button skeleton */}
      <SkeletonBlock className="w-24 h-5 rounded" />
      
      {/* Title area */}
      <div className="space-y-3">
        <SkeletonText width="80%" className="h-8" />
        <SkeletonText width="50%" className="h-4" />
      </div>
      
      {/* Meta badges row */}
      <div className="flex items-center gap-3">
        <SkeletonBlock className="w-16 h-6 rounded-full" />
        <SkeletonBlock className="w-20 h-6 rounded-full" />
        <SkeletonBlock className="w-24 h-6 rounded-full" />
      </div>
      
      {/* Description skeleton */}
      <div className="space-y-2">
        <SkeletonText width="100%" />
        <SkeletonText width="100%" />
        <SkeletonText width="90%" />
        <SkeletonText width="70%" />
        <SkeletonText width="95%" />
        <SkeletonText width="60%" />
      </div>
      
      {/* Reward card */}
      <div className="rounded-xl border border-border bg-forge-900 p-6 space-y-3">
        <SkeletonText width="120px" />
        <SkeletonBlock className="w-40 h-8 rounded" />
        <div className="flex gap-3 mt-2">
          <SkeletonBlock className="w-32 h-10 rounded-lg" />
          <SkeletonBlock className="w-32 h-10 rounded-lg" />
        </div>
      </div>
      
      {/* Submissions section */}
      <div className="space-y-2">
        <SkeletonText width="150px" className="h-5" />
        {[1, 2].map((i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 rounded-lg border border-border bg-forge-900">
            <SkeletonAvatar size="w-8 h-8" />
            <div className="flex-1 space-y-1">
              <SkeletonText width="60%" />
              <SkeletonText width="40%" />
            </div>
            <SkeletonBlock className="w-16 h-6 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
