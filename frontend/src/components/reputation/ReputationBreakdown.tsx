/**
 * ReputationBreakdown — shows how the reputation score is composed:
 *   T1 completions, T2 completions, T3 completions, review score.
 *
 * Each row has a labelled stat + a proportional fill bar.
 * @module components/reputation/ReputationBreakdown
 */
import React from 'react';
import { Skeleton } from '../common/Skeleton';
import type { ReputationBreakdown as Breakdown } from '../../types/reputation';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Star rating display (filled + empty up to 5). */
function StarRating({ value, max = 5 }: { value: number; max?: number }) {
  const full = Math.round(value);
  return (
    <span aria-label={`${value.toFixed(1)} out of ${max} stars`} className="inline-flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <svg
          key={i}
          className={`w-3.5 h-3.5 ${i < full ? 'text-amber-400' : 'text-gray-600'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  );
}

// ── Row types ─────────────────────────────────────────────────────────────────

interface BreakdownRow {
  label: string;
  value: string;
  subLabel?: string;
  /** 0–1 fill fraction for the bar */
  fill: number;
  barColor: string;
  extra?: React.ReactNode;
}

function buildRows(b: Breakdown): BreakdownRow[] {
  const maxCompletions = Math.max(b.t1Completions, b.t2Completions, b.t3Completions, 1);
  return [
    {
      label: 'T1 Completions',
      value: String(b.t1Completions),
      subLabel: `${b.t1Completions * 50} REP earned`,
      fill: b.t1Completions / maxCompletions,
      barColor: 'bg-sky-400',
    },
    {
      label: 'T2 Completions',
      value: String(b.t2Completions),
      subLabel: `${b.t2Completions * 100} REP earned`,
      fill: b.t2Completions / maxCompletions,
      barColor: 'bg-solana-purple',
    },
    {
      label: 'T3 Completions',
      value: String(b.t3Completions),
      subLabel: `${b.t3Completions * 200} REP earned`,
      fill: b.t3Completions / maxCompletions,
      barColor: 'bg-solana-green',
    },
    {
      label: 'Avg Review Score',
      value: `${b.avgReviewScore.toFixed(1)} / 5.0`,
      subLabel: `${b.reviewCount} review${b.reviewCount === 1 ? '' : 's'}`,
      fill: b.avgReviewScore / 5,
      barColor: 'bg-amber-400',
      extra: <StarRating value={b.avgReviewScore} />,
    },
  ];
}

// ── Row component ─────────────────────────────────────────────────────────────

function BreakdownRowItem({ row }: { row: BreakdownRow }) {
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm text-gray-300 font-medium truncate">{row.label}</span>
          {row.extra}
        </div>
        <div className="text-right shrink-0">
          <span className="text-sm font-mono font-bold text-gray-100">{row.value}</span>
          {row.subLabel && (
            <span className="ml-2 text-xs text-gray-600">{row.subLabel}</span>
          )}
        </div>
      </div>
      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden" aria-hidden="true">
        <div
          className={`h-full rounded-full transition-all duration-700 ${row.barColor}`}
          style={{ width: `${Math.max(row.fill * 100, row.fill > 0 ? 2 : 0)}%` }}
        />
      </div>
    </li>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function BreakdownSkeleton() {
  return (
    <div className="rounded-2xl border border-white/10 bg-surface-50 p-5 space-y-4">
      <Skeleton height="1rem" width="8rem" rounded="md" />
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="space-y-1.5">
          <div className="flex justify-between">
            <Skeleton height="0.875rem" width="9rem" rounded="sm" />
            <Skeleton height="0.875rem" width="5rem" rounded="sm" />
          </div>
          <Skeleton height="0.375rem" width="100%" rounded="full" />
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export interface ReputationBreakdownProps {
  breakdown: Breakdown;
  loading?: boolean;
  className?: string;
}

export function ReputationBreakdown({
  breakdown,
  loading = false,
  className = '',
}: ReputationBreakdownProps) {
  if (loading) return <BreakdownSkeleton />;

  const rows = buildRows(breakdown);

  return (
    <div
      className={`rounded-2xl border border-white/10 bg-surface-50 p-5 ${className}`}
      role="region"
      aria-label="Reputation breakdown"
    >
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Score Breakdown
        </h3>
        {breakdown.streak > 0 && (
          <span className="flex items-center gap-1 text-xs font-mono text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
            🔥 {breakdown.streak}d streak
          </span>
        )}
      </div>

      <ul className="space-y-4" aria-label="Reputation components">
        {rows.map(row => (
          <BreakdownRowItem key={row.label} row={row} />
        ))}
      </ul>

      {/* Point multiplier legend */}
      <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap gap-3">
        {[
          { tier: 'T1', pts: 50, color: 'bg-sky-400' },
          { tier: 'T2', pts: 100, color: 'bg-solana-purple' },
          { tier: 'T3', pts: 200, color: 'bg-solana-green' },
        ].map(({ tier, pts, color }) => (
          <span key={tier} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className={`w-2 h-2 rounded-full ${color}`} aria-hidden="true" />
            {tier} = +{pts} REP
          </span>
        ))}
      </div>
    </div>
  );
}

export default ReputationBreakdown;
