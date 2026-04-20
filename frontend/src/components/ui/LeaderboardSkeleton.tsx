import React from 'react';
import { Skeleton } from './Skeleton';

export function LeaderboardRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-lg border border-border bg-forge-900">
      <Skeleton variant="text" width={24} height={16} className="font-mono text-sm font-bold" />
      <Skeleton variant="circular" width={36} height={36} className="flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton variant="text" width="40%" height={14} />
        <Skeleton variant="text" width="25%" height={12} />
      </div>
      <div className="flex items-center gap-4">
        <Skeleton variant="text" width={60} height={12} />
        <Skeleton variant="text" width={70} height={16} className="font-mono font-semibold text-emerald" />
      </div>
    </div>
  );
}

export function LeaderboardPodiumSkeleton() {
  return (
    <div className="flex items-end justify-center gap-4 md:gap-6 mb-12">
      {[1, 0, 2].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-forge-900 flex flex-col items-center min-w-[140px]"
          style={{ paddingTop: i === 1 ? '2rem' : '1.5rem', paddingBottom: '1.5rem', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}
        >
          <Skeleton variant="text" width={20} height={16} className="mb-3" />
          <Skeleton variant="circular" width={i === 1 ? 56 : 48} height={i === 1 ? 56 : 48} className="mb-3" />
          <Skeleton variant="text" width={60} height={14} />
          <Skeleton variant="text" width={50} height={12} className="mt-1" />
          <Skeleton variant="text" width={60} height={20} className="mt-1 font-mono text-emerald" />
        </div>
      ))}
    </div>
  );
}
