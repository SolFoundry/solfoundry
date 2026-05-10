import React from 'react';

const shimmer = 'animate-shimmer bg-gradient-to-r from-forge-900 via-forge-800 to-forge-900 bg-[length:200%_100%]';

export function BountyCardSkeleton({ count = 1 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          aria-label="Loading bounty card"
          aria-busy="true"
          className={`h-52 rounded-xl border border-border ${shimmer}`}
        >
          <div className="h-full p-5">
            <div className="mb-5 h-4 w-3/4 rounded bg-white/10" />
            <div className="mb-3 h-5 w-full rounded bg-white/10" />
            <div className="h-5 w-2/3 rounded bg-white/10" />
            <div className="mt-8 flex justify-between">
              <div className="h-6 w-24 rounded bg-white/10" />
              <div className="h-6 w-20 rounded bg-white/10" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

export function LeaderboardRowSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="max-w-4xl mx-auto mt-6 rounded-xl border border-border bg-forge-900 overflow-hidden">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          aria-label="Loading leaderboard row"
          aria-busy="true"
          className={`grid grid-cols-[60px_1fr_100px_120px] items-center gap-4 border-b border-border/30 px-4 py-3 last:border-b-0 ${shimmer}`}
        >
          <div className="h-4 rounded bg-white/10" />
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-full bg-white/10" />
            <div className="h-4 w-32 rounded bg-white/10" />
          </div>
          <div className="h-4 rounded bg-white/10" />
          <div className="h-4 rounded bg-white/10" />
        </div>
      ))}
    </div>
  );
}

export function ProfileSectionSkeleton() {
  return (
    <div
      aria-label="Loading profile section"
      aria-busy="true"
      className={`rounded-xl border border-border bg-forge-900 p-6 ${shimmer}`}
    >
      <div className="flex items-center gap-4">
        <div data-testid="profile-skeleton-avatar" className="h-16 w-16 rounded-full bg-white/10" />
        <div className="flex-1 space-y-3">
          <div className="h-5 w-40 rounded bg-white/10" />
          <div className="h-4 w-64 max-w-full rounded bg-white/10" />
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} data-testid="profile-skeleton-stat" className="h-20 rounded-lg bg-white/10" />
        ))}
      </div>
    </div>
  );
}
