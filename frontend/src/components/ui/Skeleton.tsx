import React from 'react';
import { motion } from 'framer-motion';

interface SkeletonBlockProps {
  className?: string;
}

export function SkeletonBlock({ className = '' }: SkeletonBlockProps) {
  return (
    <div className={`overflow-hidden rounded-md bg-forge-800/80 ${className}`} aria-hidden="true">
      <div className="h-full w-full bg-gradient-to-r from-transparent via-white/[0.07] to-transparent bg-[length:200%_100%] animate-shimmer" />
    </div>
  );
}

function SkeletonDot({ className = '' }: SkeletonBlockProps) {
  return <SkeletonBlock className={`rounded-full ${className}`} />;
}

export function BountyCardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`relative rounded-xl border border-border bg-forge-900 p-5 overflow-hidden ${compact ? 'min-h-48' : 'min-h-52'}`}
      data-testid="bounty-card-skeleton"
      aria-hidden="true"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <SkeletonDot className="h-5 w-5 flex-shrink-0" />
          <SkeletonBlock className="h-3 w-36 max-w-[70%]" />
        </div>
        <SkeletonBlock className="h-5 w-10 rounded-full" />
      </div>

      <div className="mt-4 space-y-2">
        <SkeletonBlock className="h-4 w-full" />
        <SkeletonBlock className="h-4 w-4/5" />
      </div>

      <div className="mt-4 flex items-center gap-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="flex items-center gap-1.5">
            <SkeletonDot className="h-2.5 w-2.5" />
            <SkeletonBlock className="h-3 w-14" />
          </div>
        ))}
      </div>

      <div className="mt-5 border-t border-border/50" />

      <div className="mt-4 flex items-center justify-between gap-4">
        <SkeletonBlock className="h-5 w-24" />
        <div className="flex items-center gap-3">
          <SkeletonBlock className="h-3 w-12" />
          <SkeletonBlock className="h-3 w-14" />
        </div>
      </div>

      <SkeletonBlock className="absolute bottom-4 right-5 h-3 w-16" />
    </motion.div>
  );
}

export function BountyGridSkeleton({
  count = 6,
  columns = 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  compact = false,
}: {
  count?: number;
  columns?: string;
  compact?: boolean;
}) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading bounties" className={`grid ${columns} gap-5`}>
      <span className="sr-only">Loading bounties</span>
      {Array.from({ length: count }).map((_, index) => (
        <BountyCardSkeleton key={index} compact={compact} />
      ))}
    </div>
  );
}

function PodiumCardSkeleton({ featured = false }: { featured?: boolean }) {
  return (
    <div
      className={`relative flex min-w-[140px] flex-col items-center rounded-xl border border-border bg-forge-900 px-6 ${
        featured ? 'py-8' : 'py-6'
      }`}
      data-testid="leaderboard-podium-skeleton"
      aria-hidden="true"
    >
      <SkeletonBlock className="absolute -top-3 h-4 w-8" />
      <SkeletonDot className={`${featured ? 'h-14 w-14' : 'h-12 w-12'} border border-border`} />
      <SkeletonBlock className="mt-4 h-3 w-24" />
      <SkeletonBlock className="mt-2 h-3 w-20" />
      <SkeletonBlock className="mt-3 h-5 w-24" />
    </div>
  );
}

function LeaderboardRowSkeleton() {
  return (
    <div className="flex items-center border-b border-border/30 px-4 py-3 last:border-b-0" data-testid="leaderboard-row-skeleton">
      <div className="w-[60px]">
        <SkeletonBlock className="mx-auto h-4 w-8" />
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <SkeletonDot className="h-6 w-6 flex-shrink-0" />
        <div className="min-w-0 space-y-1.5">
          <SkeletonBlock className="h-3 w-28" />
          <div className="flex items-center gap-1">
            {[0, 1, 2, 3].map((item) => (
              <SkeletonDot key={item} className="h-2.5 w-2.5" />
            ))}
          </div>
        </div>
      </div>
      <div className="w-[100px]">
        <SkeletonBlock className="mx-auto h-4 w-10" />
      </div>
      <div className="w-[120px]">
        <SkeletonBlock className="ml-auto h-4 w-20" />
      </div>
      <div className="hidden w-[80px] sm:block">
        <SkeletonBlock className="mx-auto h-4 w-10" />
      </div>
    </div>
  );
}

export function LeaderboardSkeleton() {
  return (
    <motion.div
      role="status"
      aria-busy="true"
      aria-label="Loading leaderboard"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <span className="sr-only">Loading leaderboard</span>
      <div className="mb-12 flex items-end justify-center gap-4 md:gap-6">
        <PodiumCardSkeleton />
        <PodiumCardSkeleton featured />
        <PodiumCardSkeleton />
      </div>

      <div className="mx-auto mt-6 max-w-4xl overflow-hidden rounded-xl border border-border bg-forge-900">
        <div className="flex items-center border-b border-border/50 px-4 py-3">
          <SkeletonBlock className="mx-auto h-3 w-10" />
          <SkeletonBlock className="ml-4 h-3 flex-1" />
          <SkeletonBlock className="ml-4 h-3 w-[100px]" />
          <SkeletonBlock className="ml-4 h-3 w-[120px]" />
          <SkeletonBlock className="ml-4 hidden h-3 w-[80px] sm:block" />
        </div>
        {Array.from({ length: 5 }).map((_, index) => (
          <LeaderboardRowSkeleton key={index} />
        ))}
      </div>
    </motion.div>
  );
}

export function ProfileBountiesSkeleton() {
  return (
    <motion.div
      role="status"
      aria-busy="true"
      aria-label="Loading profile bounties"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="space-y-2"
    >
      <span className="sr-only">Loading profile bounties</span>
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 rounded-lg border border-border bg-forge-900 px-4 py-3" data-testid="profile-bounty-skeleton">
          <div className="min-w-0 flex-1 space-y-2">
            <SkeletonBlock className="h-4 w-3/4" />
            <SkeletonBlock className="h-3 w-24" />
          </div>
          <SkeletonBlock className="h-4 w-20" />
          <SkeletonBlock className="h-5 w-16 rounded-full" />
          <SkeletonBlock className="h-4 w-10" />
        </div>
      ))}
    </motion.div>
  );
}

export function BountyDetailSkeleton() {
  return (
    <motion.div
      role="status"
      aria-busy="true"
      aria-label="Loading bounty details"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="mx-auto max-w-4xl px-4 py-8"
    >
      <span className="sr-only">Loading bounty details</span>
      <div className="rounded-xl border border-border bg-forge-900 p-6">
        <div className="flex items-center justify-between gap-4">
          <SkeletonBlock className="h-4 w-28" />
          <SkeletonBlock className="h-8 w-24 rounded-lg" />
        </div>
        <div className="mt-6 space-y-3">
          <SkeletonBlock className="h-8 w-4/5" />
          <SkeletonBlock className="h-4 w-full" />
          <SkeletonBlock className="h-4 w-11/12" />
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {[0, 1, 2].map((item) => (
            <SkeletonBlock key={item} className="h-7 w-24 rounded-full" />
          ))}
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="rounded-lg border border-border bg-forge-850 p-4">
              <SkeletonBlock className="h-3 w-20" />
              <SkeletonBlock className="mt-3 h-5 w-28" />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-6 rounded-xl border border-border bg-forge-900 p-6">
        <SkeletonBlock className="h-5 w-32" />
        <div className="mt-4 space-y-2">
          <SkeletonBlock className="h-4 w-full" />
          <SkeletonBlock className="h-4 w-full" />
          <SkeletonBlock className="h-4 w-2/3" />
        </div>
      </div>
    </motion.div>
  );
}
