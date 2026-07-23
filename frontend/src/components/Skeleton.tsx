import React from 'react';

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={`rounded-lg bg-gradient-to-r from-forge-900 via-forge-800 to-forge-900 bg-[length:200%_100%] animate-shimmer ${className ?? ''}`}
    />
  );
}

export function SkeletonBountyCard() {
  return (
    <div className="rounded-xl border border-border bg-forge-900 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <Shimmer className="h-4 w-32" />
        <Shimmer className="h-5 w-8 rounded-full" />
      </div>
      <div className="space-y-2">
        <Shimmer className="h-5 w-full" />
        <Shimmer className="h-5 w-3/4" />
      </div>
      <div className="flex gap-3">
        <Shimmer className="h-3 w-16" />
        <Shimmer className="h-3 w-16" />
      </div>
      <div className="border-t border-border/50 pt-4">
        <div className="flex items-center justify-between">
          <Shimmer className="h-6 w-24" />
          <Shimmer className="h-4 w-20" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonBountyGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonBountyCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonLeaderboardRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-border/30">
      <Shimmer className="h-4 w-10" />
      <Shimmer className="h-6 w-6 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-1">
        <Shimmer className="h-4 w-32" />
        <Shimmer className="h-3 w-20" />
      </div>
      <Shimmer className="h-4 w-16" />
      <Shimmer className="h-4 w-20" />
      <Shimmer className="h-4 w-12 hidden sm:block" />
    </div>
  );
}

export function SkeletonLeaderboardTable() {
  return (
    <div className="max-w-4xl mx-auto mt-6 rounded-xl border border-border bg-forge-900 overflow-hidden">
      <div className="flex items-center px-4 py-3 border-b border-border/50">
        <Shimmer className="h-3 w-8" />
        <Shimmer className="h-3 w-12 ml-auto" />
        <Shimmer className="h-3 w-16 ml-auto" />
        <Shimmer className="h-3 w-14 ml-auto hidden sm:block" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <SkeletonLeaderboardRow key={i} />
      ))}
    </div>
  );
}

export function SkeletonProfileHeader() {
  return (
    <div className="rounded-xl border border-border bg-forge-900 p-6 mb-6">
      <div className="flex items-start gap-5">
        <Shimmer className="h-16 w-16 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Shimmer className="h-6 w-40" />
          <Shimmer className="h-4 w-56" />
        </div>
      </div>
      <div className="flex gap-1 p-1 rounded-lg bg-forge-800 mt-6 w-fit">
        {Array.from({ length: 4 }).map((_, i) => (
          <Shimmer key={i} className="h-7 w-24 rounded-md" />
        ))}
      </div>
    </div>
  );
}

export function SkeletonBountyRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-lg bg-forge-900 border border-border">
      <div className="flex-1 space-y-1">
        <Shimmer className="h-4 w-3/4" />
        <Shimmer className="h-3 w-24" />
      </div>
      <Shimmer className="h-4 w-20" />
      <Shimmer className="h-5 w-16 rounded-full" />
      <Shimmer className="h-4 w-12" />
    </div>
  );
}

export function SkeletonBountyDetail() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Shimmer className="h-4 w-32 mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-border bg-forge-900 p-6 space-y-4">
            <Shimmer className="h-4 w-48" />
            <Shimmer className="h-8 w-full" />
            <Shimmer className="h-4 w-3/4" />
            <Shimmer className="h-24 w-full" />
          </div>
          <div className="rounded-xl border border-border bg-forge-900 p-6 space-y-3">
            <Shimmer className="h-5 w-32" />
            <Shimmer className="h-4 w-full" />
            <Shimmer className="h-4 w-5/6" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-border bg-emerald-bg/50 p-5 space-y-2">
            <Shimmer className="h-3 w-12" />
            <Shimmer className="h-8 w-28" />
          </div>
          <div className="rounded-xl border border-border bg-forge-900 p-5 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <Shimmer className="h-4 w-16" />
                <Shimmer className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
