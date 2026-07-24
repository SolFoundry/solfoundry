import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'rect' | 'text' | 'circle';
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ className = '', variant = 'rect', width, height }: SkeletonProps) {
  const baseClass = 'animate-shimmer bg-gradient-to-r from-forge-900 via-forge-800 to-forge-900 bg-[length:200%_100%] rounded';
  const variantClass = variant === 'circle' ? 'rounded-full' : variant === 'text' ? 'rounded h-3' : 'rounded-lg';

  return (
    <div
      className={`${baseClass} ${variantClass} ${className}`}
      style={{ width, height }}
    />
  );
}

/** Skeleton matching the shape of a BountyCard */
export function BountyCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-forge-900 p-5">
      <div className="flex items-center justify-between mb-3">
        <Skeleton width="60%" height={14} />
        <Skeleton width={24} height={18} variant="rect" className="rounded-full" />
      </div>
      <Skeleton width="85%" height={16} className="mb-2" />
      <Skeleton width="50%" height={16} className="mb-4" />
      <div className="flex gap-3 mb-4">
        <Skeleton width={60} height={14} variant="text" />
        <Skeleton width={40} height={14} variant="text" />
      </div>
      <div className="border-t border-border/50 mb-3" />
      <div className="flex items-center justify-between">
        <Skeleton width={80} height={20} />
        <Skeleton width={60} height={14} variant="text" />
      </div>
    </div>
  );
}

/** Skeleton matching the shape of a leaderboard row */
export function LeaderboardRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-lg bg-forge-900 border border-border">
      <Skeleton width={20} height={20} variant="circle" />
      <Skeleton width={32} height={32} variant="circle" />
      <div className="flex-1">
        <Skeleton width="40%" height={14} className="mb-1" />
        <Skeleton width="20%" height={12} variant="text" />
      </div>
      <Skeleton width={60} height={16} />
    </div>
  );
}

/** Skeleton matching the shape of a profile bounties list row */
export function ProfileBountyRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-lg bg-forge-900 border border-border">
      <div className="flex-1">
        <Skeleton width="60%" height={14} className="mb-1" />
        <Skeleton width="30%" height={12} variant="text" />
      </div>
      <Skeleton width={60} height={16} />
      <Skeleton width={50} height={20} variant="rect" className="rounded-full" />
      <Skeleton width={16} height={16} variant="circle" />
    </div>
  );
}