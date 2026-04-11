import React from 'react';

/**
 * Shimmer skeleton component for loading states.
 * Matches the shape of BountyCard, leaderboard rows, profile sections.
 */

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
}

function Skeleton({ className = '', width, height, rounded = 'md' }: SkeletonProps) {
  const roundedClass = {
    none: '',
    sm: 'rounded-sm',
    md: 'rounded',
    lg: 'rounded-lg',
    full: 'rounded-full',
  }[rounded];

  return (
    <div
      className={`bg-zinc-800 animate-pulse skeleton-shimmer ${roundedClass} ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    />
  );
}

/** Skeleton for a bounty card — matches BountyDetailPage layout */
export function BountyCardSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-3">
      {/* Repo + tier row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton width={20} height={20} rounded="full" />
          <Skeleton width={120} height={12} />
        </div>
        <Skeleton width={36} height={20} rounded="full" />
      </div>

      {/* Title */}
      <Skeleton width="85%" height={16} />
      <Skeleton width="60%" height={16} />

      {/* Tags */}
      <div className="flex gap-2">
        <Skeleton width={60} height={20} rounded="full" />
        <Skeleton width={80} height={20} rounded="full" />
        <Skeleton width={50} height={20} rounded="full" />
      </div>

      {/* Reward + deadline */}
      <div className="flex items-center justify-between pt-1">
        <Skeleton width={90} height={20} />
        <Skeleton width={80} height={16} />
      </div>
    </div>
  );
}

/** Skeleton for leaderboard row */
export function LeaderboardRowSkeleton() {
  return (
    <div className="flex items-center gap-4 py-3 px-4 border-b border-zinc-800/50">
      <Skeleton width={24} height={16} />
      <Skeleton width={28} height={28} rounded="full" />
      <Skeleton width={140} height={14} />
      <div className="ml-auto flex gap-4">
        <Skeleton width={60} height={14} />
        <Skeleton width={40} height={14} />
      </div>
    </div>
  );
}

/** Skeleton for profile section */
export function ProfileSectionSkeleton() {
  return (
    <div className="space-y-4 p-6 rounded-xl border border-zinc-800 bg-zinc-900/50">
      <div className="flex items-center gap-4">
        <Skeleton width={64} height={64} rounded="full" />
        <div className="space-y-2">
          <Skeleton width={160} height={18} />
          <Skeleton width={100} height={14} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 pt-2">
        <div className="text-center">
          <Skeleton width={50} height={24} className="mx-auto mb-1" />
          <Skeleton width={70} height={12} className="mx-auto" />
        </div>
        <div className="text-center">
          <Skeleton width={50} height={24} className="mx-auto mb-1" />
          <Skeleton width={60} height={12} className="mx-auto" />
        </div>
        <div className="text-center">
          <Skeleton width={50} height={24} className="mx-auto mb-1" />
          <Skeleton width={80} height={12} className="mx-auto" />
        </div>
      </div>
    </div>
  );
}

/** Shimmer animation wrapper for any content area */
export function SkeletonPage() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between py-4 border-b border-zinc-800">
        <Skeleton width={200} height={24} />
        <Skeleton width={120} height={36} rounded="lg" />
      </div>

      {/* Grid of bounty cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <BountyCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export default Skeleton;
