import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}

const roundedMap = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
};

export function Skeleton({
  className = '',
  width,
  height,
  rounded = 'md',
}: SkeletonProps) {
  return (
    <div
      className={`animate-shimmer bg-gradient-to-r from-surface-card via-surface-hover to-surface-card bg-[length:200%_100%] ${roundedMap[rounded]} ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

// Pre-built skeleton layouts matching actual components

export function BountyCardSkeleton() {
  return (
    <div className="rounded-xl border border-border-primary bg-surface-card p-5 space-y-4">
      {/* Header: Tier badge + Status */}
      <div className="flex items-center justify-between">
        <Skeleton width="40px" height="20px" rounded="full" />
        <Skeleton width="60px" height="20px" rounded="full" />
      </div>

      {/* Title */}
      <Skeleton width="80%" height="20px" />

      {/* Description lines */}
      <div className="space-y-2">
        <Skeleton width="100%" height="14px" />
        <Skeleton width="90%" height="14px" />
        <Skeleton width="60%" height="14px" />
      </div>

      {/* Skills / Tags */}
      <div className="flex gap-2">
        <Skeleton width="60px" height="24px" rounded="full" />
        <Skeleton width="72px" height="24px" rounded="full" />
        <Skeleton width="48px" height="24px" rounded="full" />
      </div>

      {/* Footer: Reward + Time */}
      <div className="flex items-center justify-between pt-2 border-t border-border-primary">
        <Skeleton width="100px" height="16px" />
        <Skeleton width="80px" height="16px" />
      </div>
    </div>
  );
}

export function LeaderboardRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-lg bg-surface-card border border-border-primary">
      {/* Rank */}
      <Skeleton width="32px" height="32px" rounded="full" />

      {/* Avatar */}
      <Skeleton width="40px" height="40px" rounded="full" />

      {/* Name + Details */}
      <div className="flex-1 space-y-2">
        <Skeleton width="120px" height="16px" />
        <Skeleton width="180px" height="12px" />
      </div>

      {/* Score */}
      <Skeleton width="64px" height="24px" rounded="md" />
    </div>
  );
}

export function ProfileSectionSkeleton() {
  return (
    <div className="space-y-6">
      {/* Avatar + Name */}
      <div className="flex items-center gap-4">
        <Skeleton width="64px" height="64px" rounded="full" />
        <div className="space-y-2">
          <Skeleton width="140px" height="20px" />
          <Skeleton width="100px" height="14px" />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center space-y-2">
          <Skeleton width="48px" height="24px" className="mx-auto" />
          <Skeleton width="60px" height="12px" className="mx-auto" />
        </div>
        <div className="text-center space-y-2">
          <Skeleton width="48px" height="24px" className="mx-auto" />
          <Skeleton width="60px" height="12px" className="mx-auto" />
        </div>
        <div className="text-center space-y-2">
          <Skeleton width="48px" height="24px" className="mx-auto" />
          <Skeleton width="60px" height="12px" className="mx-auto" />
        </div>
      </div>

      {/* Recent bounties */}
      <div className="space-y-3">
        <Skeleton width="120px" height="18px" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-hover">
            <Skeleton width="32px" height="32px" rounded="md" />
            <div className="flex-1 space-y-1">
              <Skeleton width="70%" height="14px" />
              <Skeleton width="40%" height="12px" />
            </div>
            <Skeleton width="60px" height="16px" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function BountyGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <BountyCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function LeaderboardSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <LeaderboardRowSkeleton key={i} />
      ))}
    </div>
  );
}

export default Skeleton;
