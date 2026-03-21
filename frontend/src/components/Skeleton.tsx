/**
 * Skeleton — Animated loading placeholder components for SolFoundry.
 *
 * Components:
 * - <Skeleton />          — single animated pulse bar
 * - <SkeletonCard />      — card with title, content lines, and footer
 * - <SkeletonList />      — n × SkeletonCard
 * - <SkeletonTable />     — rows × cols table skeleton
 *
 * All use Tailwind animate-pulse with gray-700 background to match the dark theme.
 *
 * @module Skeleton
 */
import React from 'react';

// ─── Base Skeleton ─────────────────────────────────────────────────────────────

export interface SkeletonProps {
  /** Extra Tailwind classes (width, height, rounded, etc.) */
  className?: string;
}

/**
 * Skeleton — a single animated pulse placeholder.
 *
 * @example
 *   <Skeleton className="h-4 w-32 rounded" />
 */
export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`bg-gray-700 animate-pulse rounded ${className}`}
    />
  );
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────

export interface SkeletonCardProps {
  /** Extra Tailwind classes on the card wrapper */
  className?: string;
}

/**
 * SkeletonCard — card-shaped skeleton with a title bar, 3 content lines, and footer.
 */
export function SkeletonCard({ className = '' }: SkeletonCardProps) {
  return (
    <div
      aria-hidden="true"
      aria-label="Loading content"
      className={`
        bg-gray-800 border border-white/10 rounded-xl p-5 space-y-4
        ${className}
      `}
    >
      {/* Header row: title + badge placeholder */}
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-5 w-2/5 rounded" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>

      {/* Content lines */}
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-full rounded" />
        <Skeleton className="h-3.5 w-11/12 rounded" />
        <Skeleton className="h-3.5 w-4/6 rounded" />
      </div>

      {/* Footer row */}
      <div className="flex items-center justify-between pt-2 border-t border-white/5 gap-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-3.5 w-20 rounded" />
        </div>
        <Skeleton className="h-7 w-24 rounded-lg" />
      </div>
    </div>
  );
}

// ─── Skeleton List ────────────────────────────────────────────────────────────

export interface SkeletonListProps {
  /** Number of SkeletonCards to render (default: 3) */
  count?: number;
  /** Extra Tailwind classes on the list wrapper */
  className?: string;
}

/**
 * SkeletonList — renders `count` SkeletonCard placeholders in a vertical list.
 */
export function SkeletonList({ count = 3, className = '' }: SkeletonListProps) {
  return (
    <div
      aria-label="Loading list"
      aria-busy="true"
      className={`space-y-4 ${className}`}
    >
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

// ─── Skeleton Table ───────────────────────────────────────────────────────────

export interface SkeletonTableProps {
  /** Number of data rows (default: 5) */
  rows?: number;
  /** Number of columns (default: 4) */
  cols?: number;
  /** Extra Tailwind classes on the table wrapper */
  className?: string;
}

/**
 * SkeletonTable — renders an animated table skeleton with header + body rows.
 */
export function SkeletonTable({
  rows = 5,
  cols = 4,
  className = '',
}: SkeletonTableProps) {
  return (
    <div
      aria-label="Loading table"
      aria-busy="true"
      className={`
        bg-gray-800 border border-white/10 rounded-xl overflow-hidden
        ${className}
      `}
    >
      {/* Table header */}
      <div className="flex gap-3 px-5 py-3 border-b border-white/10 bg-gray-900/50">
        {Array.from({ length: cols }, (_, i) => (
          <Skeleton
            key={i}
            className={`h-3.5 rounded flex-1 ${i === 0 ? 'max-w-[8rem]' : ''}`}
          />
        ))}
      </div>

      {/* Table body */}
      <div className="divide-y divide-white/5">
        {Array.from({ length: rows }, (_, rowIdx) => (
          <div key={rowIdx} className="flex gap-3 px-5 py-4 items-center">
            {Array.from({ length: cols }, (_, colIdx) => (
              <Skeleton
                key={colIdx}
                className={`
                  h-3.5 rounded flex-1
                  ${colIdx === 0 ? 'max-w-[8rem]' : ''}
                  ${rowIdx % 2 === 1 ? 'opacity-80' : ''}
                `}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Skeleton;
