import React from 'react';
import { Skeleton } from './Skeleton';

export function BountyCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-forge-900 p-4 sm:p-5">
      {/* Row 1: Repo + Tier */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton variant="circular" width={20} height={20} className="flex-shrink-0" />
          <Skeleton variant="text" width={80} height={12} />
        </div>
        <Skeleton variant="rectangular" width={36} height={20} className="rounded-full" />
      </div>

      {/* Row 2: Title */}
      <div className="mt-3 space-y-2">
        <Skeleton variant="text" width="90%" height={14} />
        <Skeleton variant="text" width="60%" height={14} />
      </div>

      {/* Row 3: Language dots */}
      <div className="flex items-center gap-3 mt-3">
        <Skeleton variant="text" width={60} height={12} />
        <Skeleton variant="text" width={50} height={12} />
      </div>

      {/* Separator */}
      <div className="mt-4 border-t border-border/50" />

      {/* Row 4: Reward + Meta */}
      <div className="flex items-center justify-between mt-3">
        <Skeleton variant="text" width={70} height={20} />
        <div className="flex items-center gap-3">
          <Skeleton variant="text" width={40} height={12} />
          <Skeleton variant="text" width={40} height={12} />
        </div>
      </div>
    </div>
  );
}
