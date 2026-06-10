import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { skeletonPulse } from '../../lib/animations';

/* ------------------------------------------------------------------ */
/*  Primitive                                                          */
/* ------------------------------------------------------------------ */

interface SkeletonBaseProps {
  className?: string;
  style?: React.CSSProperties;
  /** If true, wraps in framer-motion for animated mount */
  animated?: boolean;
}

/**
 * A single shimmer block. Use this to compose higher-level skeletons.
 */
export function SkeletonBox({ className, style, animated = true }: SkeletonBaseProps) {
  const cls = cn(
    'relative isolate overflow-hidden rounded-lg bg-forge-800',
    'animate-shimmer bg-gradient-to-r from-forge-800 via-forge-700 to-forge-800 bg-[length:200%_100%]',
    className,
  );

  if (!animated) {
    return <div className={cls} style={style} />;
  }

  return (
    <motion.div
      variants={skeletonPulse}
      initial="initial"
      animate="animate"
      className={cls}
      style={style}
    />
  );
}

/** A single text-like line */
export function SkeletonLine({
  width = '100%',
  height = '14px',
  className,
}: {
  width?: string;
  height?: string;
  className?: string;
}) {
  return (
    <SkeletonBox
      className={cn('rounded', className)}
      style={{ width, height } as React.CSSProperties}
    />
  );
}

/** Circular avatar placeholder */
export function SkeletonAvatar({
  size = 40,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <SkeletonBox
      className={cn('rounded-full flex-shrink-0', className)}
      style={{ width: size, height: size } as React.CSSProperties}
    />
  );
}

/** Badge / pill skeleton */
export function SkeletonBadge({
  width = 48,
  height = 22,
  className,
}: {
  width?: number;
  height?: number;
  className?: string;
}) {
  return (
    <SkeletonBox
      className={cn('rounded-full', className)}
      style={{ width, height } as React.CSSProperties}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Composed skeletons                                                 */
/* ------------------------------------------------------------------ */

/**
 * Matches the shape of `BountyCard`:
 *
 * 鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? * 鈹?[icon] org/repo          [T1]  鈹? * 鈹?                                鈹? * 鈹? Title text line                鈹? * 鈹? Title line 2 (if long)         鈹? * 鈹?                                鈹? * 鈹? 鈼?TypeScript  鈼?Rust          鈹? * 鈹?鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ 鈹? * 鈹? 100,000 $FNDRY    3 PRs 2d l  鈹? * 鈹?                             鈼? 鈹? * 鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? */
export function SkeletonBountyCard({ animated = true }: { animated?: boolean }) {
  return (
    <div className="relative rounded-xl border border-border bg-forge-900 p-5 overflow-hidden">
      {/* Row 1: repo + tier */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SkeletonAvatar size={20} />
          <SkeletonLine width={140} height={12} />
        </div>
        <SkeletonBadge width={40} height={20} />
      </div>

      {/* Row 2: title */}
      <div className="mt-4 space-y-2">
        <SkeletonLine width="85%" height={16} />
        <SkeletonLine width="55%" height={16} />
      </div>

      {/* Row 3: skill dots */}
      <div className="flex items-center gap-3 mt-4">
        <SkeletonLine width={90} height={14} />
        <SkeletonLine width={60} height={14} />
      </div>

      {/* Separator */}
      <div className="mt-4 border-t border-border/50" />

      {/* Row 4: reward + meta */}
      <div className="flex items-center justify-between mt-3">
        <SkeletonLine width={130} height={20} />
        <div className="flex items-center gap-3">
          <SkeletonLine width={60} height={12} />
          <SkeletonLine width={70} height={12} />
        </div>
      </div>

      {/* Status dot */}
      <SkeletonBox className="absolute bottom-4 right-5 w-14 h-4" />
    </div>
  );
}

/**
 * A grid of bounty-card skeletons.
 * Drop-in replacement for the current inline loading state in BountyGrid.
 */
export function SkeletonBountyGrid({
  count = 6,
  cols = 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
}: {
  count?: number;
  cols?: string;
}) {
  return (
    <div className={cn('grid gap-5', cols)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBountyCard key={`sk-card-${i}`} />
      ))}
    </div>
  );
}

/**
 * Matches the shape of `LeaderboardTable` rows:
 *
 * 鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? * 鈹?Rank 鈹?User                    鈹?Bounties 鈹?Earned 鈹?Streak 鈹? * 鈹溾攢鈹€鈹€鈹€鈹€鈹€鈹尖攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹尖攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹尖攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹尖攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹? * 鈹?#4   鈹?[avatar] username       鈹?   12    鈹?$4.2K  鈹? 馃敟 5  鈹? * 鈹?#5   鈹?[avatar] username       鈹?    8    鈹?$3.1K  鈹?  鈥?   鈹? * ...
 */
export function SkeletonLeaderboardRow() {
  return (
    <div className="flex items-center px-4 py-3 border-b border-border/30 last:border-b-0">
      <SkeletonLine width={48} height={14} className="text-center mr-0" />
      <div className="flex-1 flex items-center gap-3 ml-4">
        <SkeletonAvatar size={24} />
        <SkeletonLine width={120} height={14} />
      </div>
      <SkeletonLine width={60} height={14} className="text-center" />
      <SkeletonLine width={80} height={16} className="text-right" />
      <SkeletonLine width={40} height={14} className="text-center hidden sm:block" />
    </div>
  );
}

export function SkeletonLeaderboardTable({ rows = 6 }: { rows?: number }) {
  return (
    <div className="max-w-4xl mx-auto mt-6 rounded-xl border border-border bg-forge-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center px-4 py-3 border-b border-border/50">
        <SkeletonLine width={48} height={12} />
        <div className="flex-1 ml-4">
          <SkeletonLine width={40} height={12} />
        </div>
        <SkeletonLine width={60} height={12} />
        <SkeletonLine width={80} height={12} />
        <SkeletonLine width={40} height={12} className="hidden sm:block" />
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonLeaderboardRow key={`sk-lb-${i}`} />
      ))}
    </div>
  );
}

/**
 * Matches the shape of profile sections.
 * Generic enough to be reused across profile dashboards and detail pages.
 */
export function SkeletonProfileSection() {
  return (
    <div className="rounded-xl border border-border bg-forge-900 p-6 space-y-5">
      {/* Header with avatar + name */}
      <div className="flex items-center gap-4">
        <SkeletonAvatar size={56} />
        <div className="space-y-2 flex-1">
          <SkeletonLine width="50%" height={20} />
          <SkeletonLine width="35%" height={13} />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={`stat-${i}`} className="space-y-1.5">
            <SkeletonLine width="60%" height={24} />
            <SkeletonLine width="80%" height={11} />
          </div>
        ))}
      </div>

      {/* Body lines */}
      <div className="space-y-2.5">
        <SkeletonLine width="100%" height={12} />
        <SkeletonLine width="90%" height={12} />
        <SkeletonLine width="70%" height={12} />
      </div>
    </div>
  );
}

/**
 * Podium skeleton 鈥?matches `PodiumCards` shape.
 */
export function SkeletonPodium() {
  return (
    <div className="flex items-end justify-center gap-4 max-w-2xl mx-auto">
      {/* 2nd place */}
      <div className="flex flex-col items-center gap-2">
        <SkeletonAvatar size={40} />
        <SkeletonLine width={80} height={14} />
        <SkeletonBox className="w-24 h-24 rounded-t-xl" />
      </div>
      {/* 1st place */}
      <div className="flex flex-col items-center gap-2">
        <SkeletonAvatar size={48} />
        <SkeletonLine width={100} height={16} />
        <SkeletonBox className="w-28 h-32 rounded-t-xl" />
      </div>
      {/* 3rd place */}
      <div className="flex flex-col items-center gap-2">
        <SkeletonAvatar size={36} />
        <SkeletonLine width={70} height={12} />
        <SkeletonBox className="w-20 h-20 rounded-t-xl" />
      </div>
    </div>
  );
}
