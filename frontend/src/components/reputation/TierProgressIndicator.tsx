/**
 * TierProgressIndicator — visual progress bar towards the next tier,
 * with a plain-text "N completions to unlock TierX" label below.
 *
 * Composes the existing TierProgressBar and adds:
 *   - "Progress to next tier" header
 *   - Requirement callout ("3 more T1 merges to unlock T2")
 *   - Points-per-tier legend
 *   - Loading skeleton
 *
 * @module components/reputation/TierProgressIndicator
 */
import React from 'react';
import { TierProgressBar } from '../common/TierProgressBar';
import { Skeleton } from '../common/Skeleton';
import type { Tier } from '../../types/reputation';

// ── Next-tier requirement message ─────────────────────────────────────────────

function nextTierMessage(
  tier: Tier,
  t1: number,
  t2: number,
  t3: number,
): string {
  if (tier === 'T3') return '🏆 Maximum tier reached — nothing higher to unlock.';
  if (tier === 'T1') {
    const needed = Math.max(0, 4 - t1);
    return needed === 0
      ? 'T2 requirements met — keep completing bounties!'
      : `${needed} more T1 merge${needed === 1 ? '' : 's'} needed to unlock T2`;
  }
  // T2 → T3
  const path1 = Math.max(0, 3 - t2);
  const path2t1 = Math.max(0, 5 - t1);
  const path2t2 = Math.max(0, 1 - t2);
  if (path1 === 0 || (path2t1 === 0 && path2t2 === 0)) {
    return 'T3 requirements met — keep completing bounties!';
  }
  const msgA = path1 > 0 ? `${path1} more T2 merge${path1 === 1 ? '' : 's'}` : null;
  const msgB = path2t1 > 0 || path2t2 > 0
    ? [path2t1 > 0 && `${path2t1} T1`, path2t2 > 0 && `${path2t2} T2`]
        .filter(Boolean).join(' + ') + ' merge' + (path2t1 + path2t2 > 1 ? 's' : '')
    : null;
  const parts = [msgA, msgB].filter(Boolean);
  return parts.length === 2
    ? `To unlock T3: ${parts[0]} (or ${parts[1]})`
    : `To unlock T3: ${parts[0]}`;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function TierProgressSkeleton({ className }: { className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-surface-50 p-5 space-y-4 ${className}`}>
      <Skeleton height="1rem" width="10rem" rounded="md" />
      <div className="space-y-2">
        <div className="flex justify-between">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} height="0.75rem" width="4rem" rounded="sm" />
          ))}
        </div>
        <Skeleton height="0.375rem" width="100%" rounded="full" />
      </div>
      <Skeleton height="0.875rem" width="14rem" rounded="sm" />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export interface TierProgressIndicatorProps {
  tier: Tier;
  t1Completions: number;
  t2Completions: number;
  t3Completions: number;
  loading?: boolean;
  className?: string;
}

export function TierProgressIndicator({
  tier,
  t1Completions,
  t2Completions,
  t3Completions,
  loading = false,
  className = '',
}: TierProgressIndicatorProps) {
  if (loading) return <TierProgressSkeleton className={className} />;

  const message = nextTierMessage(tier, t1Completions, t2Completions, t3Completions);
  const isMaxTier = tier === 'T3';

  return (
    <div
      className={`rounded-2xl border border-white/10 bg-surface-50 p-5 ${className}`}
      role="region"
      aria-label="Tier progress"
    >
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
        Tier Progress
      </h3>

      {/* Existing TierProgressBar handles the visual track */}
      <TierProgressBar
        completedT1={t1Completions}
        completedT2={t2Completions}
        completedT3={t3Completions}
      />

      {/* Next-tier callout */}
      <div
        className={`mt-4 rounded-lg px-3 py-2 text-xs font-mono
          ${isMaxTier
            ? 'bg-solana-green/10 text-solana-green border border-solana-green/20'
            : 'bg-white/5 text-gray-400 border border-white/5'}`}
        aria-live="polite"
      >
        {message}
      </div>

      {/* Per-tier point legend */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-center">
        {[
          { tier: 'T1', pts: 50, active: tier === 'T1', color: 'text-sky-400', border: 'border-sky-500/20' },
          { tier: 'T2', pts: 100, active: tier === 'T2', color: 'text-solana-purple', border: 'border-solana-purple/20' },
          { tier: 'T3', pts: 200, active: tier === 'T3', color: 'text-solana-green', border: 'border-solana-green/20' },
        ].map(row => (
          <div
            key={row.tier}
            className={`rounded-lg border py-1.5 font-mono ${row.border}
              ${row.active ? 'bg-white/5' : 'bg-transparent opacity-60'}`}
          >
            <div className={`font-bold ${row.color}`}>{row.tier}</div>
            <div className="text-gray-500">+{row.pts} REP</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TierProgressIndicator;
