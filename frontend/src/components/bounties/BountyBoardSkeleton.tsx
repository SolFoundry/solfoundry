/**
 * Loading skeleton components for data-fetching surfaces.
 * Provides visual feedback during API loading states.
 * @module components/common/LoadingSkeletons
 */

import React from 'react';

/** Generic shimmer effect for skeleton elements */
function Shimmer() {
  return (
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
  );
}

/** Base skeleton box with shimmer effect */
interface SkeletonBoxProps {
  className?: string;
}

function SkeletonBox({ className = '' }: SkeletonBoxProps) {
  return (
    <div className={`relative overflow-hidden bg-gray-800 rounded ${className}`}>
      <Shimmer />
    </div>
  );
}

/** Bounty card skeleton */
export function BountyCardSkeleton() {
  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-white/5 space-y-3">
      {/* Title */}
      <SkeletonBox className="h-5 w-3/4" />
      
      {/* Meta row */}
      <div className="flex items-center gap-2">
        <SkeletonBox className="h-4 w-16" />
        <SkeletonBox className="h-4 w-20" />
      </div>
      
      {/* Skills */}
      <div className="flex gap-2">
        <SkeletonBox className="h-6 w-16 rounded-full" />
        <SkeletonBox className="h-6 w-20 rounded-full" />
        <SkeletonBox className="h-6 w-14 rounded-full" />
      </div>
      
      {/* Bottom row */}
      <div className="flex items-center justify-between pt-2">
        <SkeletonBox className="h-4 w-24" />
        <SkeletonBox className="h-6 w-20 rounded" />
      </div>
    </div>
  );
}

/** Bounty board grid skeleton */
export function BountyBoardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <BountyCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Contributor row skeleton for leaderboard */
export function ContributorRowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-white/5">
      {/* Rank */}
      <SkeletonBox className="h-6 w-8" />
      
      {/* Avatar */}
      <SkeletonBox className="h-10 w-10 rounded-full" />
      
      {/* Username */}
      <div className="flex-1">
        <SkeletonBox className="h-5 w-32" />
      </div>
      
      {/* Stats */}
      <div className="flex gap-6">
        <SkeletonBox className="h-5 w-16" />
        <SkeletonBox className="h-5 w-20" />
        <SkeletonBox className="h-5 w-16" />
      </div>
    </div>
  );
}

/** Leaderboard skeleton */
export function LeaderboardSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="bg-gray-900 rounded-lg border border-white/5">
      {Array.from({ length: count }).map((_, i) => (
        <ContributorRowSkeleton key={i} />
      ))}
    </div>
  );
}

/** Stat card skeleton */
export function StatCardSkeleton() {
  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-2">
      <SkeletonBox className="h-4 w-20" />
      <SkeletonBox className="h-7 w-32" />
    </div>
  );
}

/** Tokenomics section skeleton */
export function TokenomicsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      
      {/* Chart placeholder */}
      <div className="bg-gray-900 rounded-lg p-6 border border-white/5">
        <SkeletonBox className="h-64 w-full" />
      </div>
      
      {/* Distribution breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 space-y-3">
          <SkeletonBox className="h-5 w-32" />
          <SkeletonBox className="h-20 w-full" />
        </div>
        <div className="bg-gray-800 rounded-lg p-4 space-y-3">
          <SkeletonBox className="h-5 w-28" />
          <SkeletonBox className="h-20 w-full" />
        </div>
      </div>
    </div>
  );
}

/** Contributor profile skeleton */
export function ContributorProfileSkeleton() {
  return (
    <div className="bg-gray-900 rounded-lg p-6 text-white space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <SkeletonBox className="h-20 w-20 rounded-full" />
        <div className="flex-1 space-y-2">
          <SkeletonBox className="h-6 w-40" />
          <SkeletonBox className="h-4 w-32" />
        </div>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      
      {/* Badge section */}
      <div className="space-y-3">
        <SkeletonBox className="h-5 w-32" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonBox key={i} className="h-10 w-10 rounded-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Empty state component */
interface EmptyStateProps {
  title?: string;
  message?: string;
  action?: React.ReactNode;
}

export function EmptyState({ 
  title = 'No data available', 
  message = 'There is no data to display at this time.',
  action 
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <svg 
        className="w-16 h-16 text-gray-600 mb-4" 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={1.5} 
          d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" 
        />
      </svg>
      <h3 className="text-lg font-medium text-gray-300 mb-2">{title}</h3>
      <p className="text-gray-500 text-sm mb-4">{message}</p>
      {action}
    </div>
  );
}

/** Error state component */
interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ 
  title = 'Something went wrong', 
  message = 'An error occurred while loading data.',
  onRetry 
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <svg 
        className="w-16 h-16 text-red-400 mb-4" 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={1.5} 
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
        />
      </svg>
      <h3 className="text-lg font-medium text-gray-300 mb-2">{title}</h3>
      <p className="text-gray-500 text-sm mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-[#9945FF] text-white rounded-lg hover:bg-[#9945FF]/80 transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  );
}