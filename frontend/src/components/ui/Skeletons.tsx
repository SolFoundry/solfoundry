import React from 'react';

function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`overflow-hidden rounded bg-forge-800 ${className}`}
    >
      <div className="h-full w-full bg-gradient-to-r from-forge-800 via-forge-700 to-forge-800 bg-[length:200%_100%] animate-shimmer" />
    </div>
  );
}

export function BountyCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      data-testid="bounty-card-skeleton"
      className="rounded-xl border border-border bg-forge-900 p-5"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <SkeletonBlock className="h-5 w-5 rounded-full flex-shrink-0" />
          <SkeletonBlock className="h-3 w-36 max-w-full" />
        </div>
        <SkeletonBlock className="h-5 w-10 rounded-full" />
      </div>

      <div className="mt-4 space-y-2">
        <SkeletonBlock className="h-4 w-11/12" />
        <SkeletonBlock className="h-4 w-2/3" />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <SkeletonBlock className="h-3 w-20 rounded-full" />
        <SkeletonBlock className="h-3 w-14 rounded-full" />
        <SkeletonBlock className="h-3 w-16 rounded-full" />
      </div>

      <div className="mt-5 border-t border-border/50 pt-4">
        <div className="flex items-center justify-between gap-4">
          <SkeletonBlock className="h-5 w-24" />
          <div className="flex items-center gap-3">
            <SkeletonBlock className="h-3 w-12 rounded-full" />
            <SkeletonBlock className="h-3 w-16 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function BountyGridSkeleton({ count = 6, className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5' }: { count?: number; className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading bounties"
      className={className}
    >
      {Array.from({ length: count }).map((_, index) => (
        <BountyCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function LeaderboardSkeleton() {
  return (
    <div role="status" aria-label="Loading leaderboard" className="space-y-8">
      <div className="flex items-end justify-center gap-4 md:gap-6">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className={`rounded-xl border border-border bg-forge-900 px-6 ${index === 1 ? 'py-8' : 'py-6'} min-w-[140px] flex flex-col items-center`}
          >
            <SkeletonBlock className={`${index === 1 ? 'h-14 w-14' : 'h-12 w-12'} rounded-full`} />
            <SkeletonBlock className="mt-3 h-4 w-24" />
            <SkeletonBlock className="mt-2 h-3 w-20" />
            <SkeletonBlock className="mt-3 h-5 w-24" />
          </div>
        ))}
      </div>

      <div className="max-w-4xl mx-auto rounded-xl border border-border bg-forge-900 overflow-hidden">
        <div className="flex items-center px-4 py-3 border-b border-border/50">
          <SkeletonBlock className="h-3 w-12" />
          <SkeletonBlock className="ml-8 h-3 w-24" />
          <SkeletonBlock className="ml-auto h-3 w-20" />
        </div>
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} data-testid="leaderboard-row-skeleton" className="flex items-center gap-3 px-4 py-3 border-b border-border/30 last:border-b-0">
            <SkeletonBlock className="h-4 w-10" />
            <SkeletonBlock className="h-6 w-6 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <SkeletonBlock className="h-3 w-32" />
              <SkeletonBlock className="h-2.5 w-20" />
            </div>
            <SkeletonBlock className="h-4 w-16" />
            <SkeletonBlock className="h-4 w-20 hidden sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProfileBountyListSkeleton() {
  return (
    <div role="status" aria-label="Loading profile bounties" className="space-y-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} data-testid="profile-bounty-skeleton" className="flex items-center gap-4 px-4 py-3 rounded-lg bg-forge-900 border border-border">
          <div className="flex-1 min-w-0 space-y-2">
            <SkeletonBlock className="h-4 w-3/4" />
            <SkeletonBlock className="h-3 w-24" />
          </div>
          <SkeletonBlock className="h-4 w-20" />
          <SkeletonBlock className="h-5 w-16 rounded-full" />
          <SkeletonBlock className="h-3 w-10" />
        </div>
      ))}
    </div>
  );
}

export function BountyDetailSkeleton() {
  return (
    <div role="status" aria-label="Loading bounty detail" className="max-w-4xl mx-auto px-4 py-8">
      <SkeletonBlock className="mb-6 h-4 w-32" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-border bg-forge-900 p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="flex-1 space-y-3">
                <SkeletonBlock className="h-3 w-44" />
                <SkeletonBlock className="h-7 w-4/5" />
              </div>
              <SkeletonBlock className="h-10 w-10 rounded-lg" />
            </div>
            <div className="flex gap-3 mb-5">
              <SkeletonBlock className="h-3 w-20 rounded-full" />
              <SkeletonBlock className="h-3 w-16 rounded-full" />
            </div>
            <div className="space-y-2">
              <SkeletonBlock className="h-4 w-full" />
              <SkeletonBlock className="h-4 w-11/12" />
              <SkeletonBlock className="h-4 w-2/3" />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-forge-900 p-6 space-y-3">
            <SkeletonBlock className="h-5 w-32" />
            <SkeletonBlock className="h-4 w-full" />
            <SkeletonBlock className="h-4 w-5/6" />
          </div>

          <div className="rounded-xl border border-border bg-forge-900 p-6 space-y-4">
            <SkeletonBlock className="h-5 w-40" />
            <SkeletonBlock className="h-10 w-full rounded-lg" />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-border bg-emerald-bg/50 p-5 space-y-2">
            <SkeletonBlock className="h-3 w-16" />
            <SkeletonBlock className="h-8 w-40" />
          </div>
          <div className="rounded-xl border border-border bg-forge-900 p-5 space-y-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center justify-between gap-4">
                <SkeletonBlock className="h-3 w-20" />
                <SkeletonBlock className="h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
