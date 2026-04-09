import React from 'react';

export function BountyCardSkeleton() {
  return (
    <div className="relative rounded-xl border border-border bg-forge-900 p-5 overflow-hidden animate-pulse">
      {/* Shimmer overlay */}
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-forge-700/20 to-transparent" />

      {/* Header: tier badge + status */}
      <div className="flex items-center justify-between mb-3">
        <div className="h-5 w-10 rounded-full bg-forge-800" />
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-forge-800" />
          <div className="h-3 w-12 rounded bg-forge-800" />
        </div>
      </div>

      {/* Org / repo line */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-4 h-4 rounded-full bg-forge-800" />
        <div className="h-3 w-32 rounded bg-forge-800 font-mono" />
      </div>

      {/* Title */}
      <div className="space-y-2 mb-4">
        <div className="h-4 w-full rounded bg-forge-800" />
        <div className="h-4 w-3/4 rounded bg-forge-800" />
      </div>

      {/* Skills */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-forge-800" />
          <div className="h-3 w-14 rounded bg-forge-800" />
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-forge-800" />
          <div className="h-3 w-10 rounded bg-forge-800" />
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-forge-800" />
          <div className="h-3 w-12 rounded bg-forge-800" />
        </div>
      </div>

      {/* Footer: reward + time */}
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <div className="h-5 w-24 rounded bg-forge-800" />
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded bg-forge-800" />
          <div className="h-3 w-16 rounded bg-forge-800" />
        </div>
      </div>
    </div>
  );
}
