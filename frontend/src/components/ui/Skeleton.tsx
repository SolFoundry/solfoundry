/**
 * Skeleton primitives and page-level skeletons for SolFoundry.
 * All shimmer via the .animate-shimmer class (defined in index.css).
 */

function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded bg-forge-800 overflow-hidden relative ${className}`}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-forge-800 via-forge-700 to-forge-800 bg-[length:200%_100%] animate-shimmer" />
    </div>
  );
}

/** Matches BountyCard layout */
export function BountyCardSkeleton() {
  return (
    <div
      className="relative rounded-xl border border-border bg-forge-900 p-5 space-y-4 overflow-hidden"
      aria-label="Loading bounty"
    >
      {/* Tier + reward row */}
      <div className="flex items-center justify-between">
        <SkeletonBlock className="h-5 w-16" />
        <SkeletonBlock className="h-5 w-24" />
      </div>
      {/* Title */}
      <SkeletonBlock className="h-5 w-3/4" />
      <SkeletonBlock className="h-4 w-1/2" />
      {/* Tags */}
      <div className="flex gap-2">
        <SkeletonBlock className="h-5 w-16 rounded-full" />
        <SkeletonBlock className="h-5 w-12 rounded-full" />
        <SkeletonBlock className="h-5 w-14 rounded-full" />
      </div>
      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <SkeletonBlock className="h-4 w-20" />
        <SkeletonBlock className="h-4 w-16" />
      </div>
    </div>
  );
}

/** Grid of 6 BountyCardSkeletons */
export function BountyGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <BountyCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Matches a leaderboard row */
export function LeaderboardRowSkeleton() {
  return (
    <div
      className="flex items-center gap-4 px-4 py-3 rounded-lg border border-border bg-forge-900"
      aria-label="Loading leaderboard entry"
    >
      <SkeletonBlock className="h-6 w-6 rounded-full shrink-0" />
      <SkeletonBlock className="h-8 w-8 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <SkeletonBlock className="h-4 w-32" />
        <SkeletonBlock className="h-3 w-20" />
      </div>
      <SkeletonBlock className="h-5 w-16" />
      <SkeletonBlock className="h-5 w-12" />
    </div>
  );
}

/** Stack of N leaderboard row skeletons */
export function LeaderboardSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <LeaderboardRowSkeleton key={i} />
      ))}
    </div>
  );
}

/** Profile page skeleton */
export function ProfileSkeleton() {
  return (
    <div className="max-w-2xl mx-auto space-y-6" aria-label="Loading profile">
      {/* Avatar + name */}
      <div className="flex items-center gap-4">
        <SkeletonBlock className="h-16 w-16 rounded-full shrink-0" />
        <div className="space-y-2 flex-1">
          <SkeletonBlock className="h-5 w-40" />
          <SkeletonBlock className="h-4 w-28" />
        </div>
      </div>
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-forge-900 p-4 space-y-2">
            <SkeletonBlock className="h-6 w-12" />
            <SkeletonBlock className="h-3 w-20" />
          </div>
        ))}
      </div>
      {/* Recent activity */}
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
