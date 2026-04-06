import React from 'react';

function ShimmerBlock({ className = '' }: { className?: string }) {
  return (
    <div className={`overflow-hidden rounded-md bg-forge-800 ${className}`}>
      <div className="h-full w-full bg-gradient-to-r from-forge-800 via-forge-700 to-forge-800 bg-[length:200%_100%] animate-shimmer" />
    </div>
  );
}

export function BountyCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-forge-900 p-5" aria-busy="true">
      <div className="flex items-center justify-between gap-3">
        <ShimmerBlock className="h-4 w-32" />
        <ShimmerBlock className="h-5 w-10 rounded-full" />
      </div>
      <ShimmerBlock className="mt-4 h-5 w-4/5" />
      <ShimmerBlock className="mt-2 h-4 w-3/5" />
      <div className="mt-4 flex gap-2">
        <ShimmerBlock className="h-4 w-16" />
        <ShimmerBlock className="h-4 w-14" />
        <ShimmerBlock className="h-4 w-12" />
      </div>
      <div className="mt-4 border-t border-border/50 pt-4 flex items-center justify-between">
        <ShimmerBlock className="h-6 w-24" />
        <ShimmerBlock className="h-4 w-20" />
      </div>
    </div>
  );
}

export function LeaderboardRowSkeleton() {
  return (
    <div className="flex items-center px-4 py-3 border-b border-border/30 last:border-b-0" aria-busy="true">
      <ShimmerBlock className="h-4 w-10 mr-4" />
      <div className="flex flex-1 items-center gap-3">
        <ShimmerBlock className="h-6 w-6 rounded-full" />
        <div className="flex-1">
          <ShimmerBlock className="h-4 w-28" />
          <div className="mt-2 flex gap-1">
            <ShimmerBlock className="h-2.5 w-2.5 rounded-full" />
            <ShimmerBlock className="h-2.5 w-2.5 rounded-full" />
            <ShimmerBlock className="h-2.5 w-2.5 rounded-full" />
          </div>
        </div>
      </div>
      <ShimmerBlock className="h-4 w-12 mr-6" />
      <ShimmerBlock className="h-4 w-20 mr-6" />
      <ShimmerBlock className="h-4 w-10 hidden sm:block" />
    </div>
  );
}

export function ProfileBountyRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-lg bg-forge-900 border border-border" aria-busy="true">
      <div className="flex-1 min-w-0">
        <ShimmerBlock className="h-4 w-3/5" />
        <ShimmerBlock className="mt-2 h-3 w-24" />
      </div>
      <ShimmerBlock className="h-5 w-20" />
      <ShimmerBlock className="h-5 w-16 rounded-full" />
      <ShimmerBlock className="h-4 w-10" />
    </div>
  );
}

export function ProfileSummarySkeleton() {
  return (
    <div className="rounded-xl border border-border bg-forge-900 p-6 mb-6" aria-busy="true">
      <div className="flex items-start gap-5">
        <ShimmerBlock className="h-16 w-16 rounded-full" />
        <div className="flex-1">
          <ShimmerBlock className="h-6 w-40" />
          <ShimmerBlock className="mt-3 h-4 w-48" />
        </div>
      </div>
      <div className="mt-6 flex gap-2">
        <ShimmerBlock className="h-8 w-24 rounded-md" />
        <ShimmerBlock className="h-8 w-28 rounded-md" />
        <ShimmerBlock className="h-8 w-20 rounded-md" />
      </div>
    </div>
  );
}
