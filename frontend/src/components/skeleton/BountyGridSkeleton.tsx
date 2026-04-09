import React from 'react';
import { BountyCardSkeleton } from './BountyCardSkeleton';

interface BountyGridSkeletonProps {
  count?: number;
}

export function BountyGridSkeleton({ count = 6 }: BountyGridSkeletonProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <BountyCardSkeleton key={i} />
      ))}
    </div>
  );
}
