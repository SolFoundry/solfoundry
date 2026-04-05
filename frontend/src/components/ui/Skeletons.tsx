import React from 'react';

function ShimmerBlock({ className = '' }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-md bg-gray-800 ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-gray-700/40 to-transparent" />
    </div>
  );
}

export function BountyCardSkeleton() {
  return (
    <div className="rounded-lg border border-gray-800 bg-forge-950 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <ShimmerBlock className="h-5 w-32" />
        <ShimmerBlock className="h-5 w-12 rounded-full" />
      </div>
      <ShimmerBlock className="h-4 w-full" />
      <ShimmerBlock className="h-4 w-3/4" />
      <div className="flex gap-2">
        <ShimmerBlock className="h-6 w-16 rounded-full" />
        <ShimmerBlock className="h-6 w-20 rounded-full" />
        <ShimmerBlock className="h-6 w-14 rounded-full" />
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-gray-800">
        <ShimmerBlock className="h-4 w-24" />
        <ShimmerBlock className="h-4 w-16" />
      </div>
    </div>
  );
}

export function LeaderboardRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-800">
      <ShimmerBlock className="h-6 w-6 rounded-full" />
      <ShimmerBlock className="h-8 w-8 rounded-full" />
      <div className="flex-1 space-y-1">
        <ShimmerBlock className="h-4 w-32" />
        <ShimmerBlock className="h-3 w-20" />
      </div>
      <ShimmerBlock className="h-5 w-16" />
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <ShimmerBlock className="h-16 w-16 rounded-full" />
        <div className="space-y-2 flex-1">
          <ShimmerBlock className="h-6 w-40" />
          <ShimmerBlock className="h-4 w-24" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[1,2,3].map(i => <ShimmerBlock key={i} className="h-20 rounded-lg" />)}
      </div>
      <div className="space-y-2">
        {[1,2,3,4].map(i => <ShimmerBlock key={i} className="h-12 rounded-lg" />)}
      </div>
    </div>
  );
}

export function BountyGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => <BountyCardSkeleton key={i} />)}
    </div>
  );
}
