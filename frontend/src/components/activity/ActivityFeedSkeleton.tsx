import React from 'react';
import { ShimmerBlock } from './Skeleton';

export function ActivityFeedSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-lg bg-forge-900 border border-border">
          <ShimmerBlock className="w-5 h-5 rounded shrink-0" />
          <div className="flex-1 space-y-1.5">
            <ShimmerBlock className="w-36 h-4" />
            <ShimmerBlock className="w-64 h-3" />
          </div>
          <ShimmerBlock className="w-10 h-4 rounded" />
        </div>
      ))}
    </div>
  );
}
