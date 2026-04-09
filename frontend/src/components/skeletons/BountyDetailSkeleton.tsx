import React from 'react';
import { Skeleton, CircleSkeleton } from './Skeleton';

/**
 * Skeleton loader for BountyDetail component.
 * Matches the exact 3-column layout of BountyDetail with shimmer animation.
 */
export function BountyDetailSkeleton() {
  return (
    <div 
      className="max-w-4xl mx-auto px-4 py-8"
      aria-busy="true"
      aria-label="Loading bounty details"
      role="status"
    >
      {/* Back link skeleton */}
      <Skeleton className="h-5 w-32 mb-6" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content - 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title + meta card */}
          <div className="rounded-xl border border-border bg-forge-900 p-6 space-y-4">
            {/* Repo info */}
            <div className="flex items-center gap-2">
              <CircleSkeleton size="1rem" />
              <Skeleton className="h-4 w-48" />
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-2/3" />
            </div>

            {/* Skills */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Skeleton className="w-2.5 h-2.5 rounded-full" />
                <Skeleton className="h-3 w-16" />
              </div>
              <div className="flex items-center gap-1.5">
                <Skeleton className="w-2.5 h-2.5 rounded-full" />
                <Skeleton className="h-3 w-14" />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2 pt-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>

            {/* Link */}
            <Skeleton className="h-4 w-32 mt-4" />
          </div>

          {/* Requirements card */}
          <div className="rounded-xl border border-border bg-forge-900 p-6 space-y-4">
            <Skeleton className="h-6 w-32" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          </div>

          {/* Submission form card */}
          <div className="rounded-xl border border-border bg-forge-900 p-6 space-y-4">
            <Skeleton className="h-6 w-40" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-10 w-32" />
            </div>
          </div>
        </div>

        {/* Sidebar - 1 column */}
        <div className="space-y-4">
          {/* Reward card */}
          <div className="rounded-xl border border-emerald-border bg-emerald-bg/50 p-5 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-10 w-32" />
          </div>

          {/* Info card */}
          <div className="rounded-xl border border-border bg-forge-900 p-5 space-y-4">
            {/* Status */}
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-4 w-16" />
            </div>

            {/* Tier */}
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-4 w-8" />
            </div>

            {/* Deadline */}
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>

            {/* Submissions */}
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>

            {/* Posted */}
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
