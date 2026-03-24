/**
 * ReputationScoreCard — displays the headline reputation score, tier badge,
 * and global leaderboard rank.
 * @module components/reputation/ReputationScoreCard
 */
import React from 'react';
import { Skeleton } from '../common/Skeleton';
import type { Tier } from '../../types/reputation';

// ── Tier config ───────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<Tier, { label: string; color: string; bg: string; ring: string; glow: string }> = {
  T1: {
    label: 'Tier 1',
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
    ring: 'ring-sky-500/30',
    glow: 'shadow-sky-500/20',
  },
  T2: {
    label: 'Tier 2',
    color: 'text-solana-purple',
    bg: 'bg-solana-purple/10',
    ring: 'ring-solana-purple/30',
    glow: 'shadow-solana-purple/20',
  },
  T3: {
    label: 'Tier 3',
    color: 'text-solana-green',
    bg: 'bg-solana-green/10',
    ring: 'ring-solana-green/30',
    glow: 'shadow-solana-green/20',
  },
};

// ── Rank badge ────────────────────────────────────────────────────────────────

function RankBadge({ rank, total }: { rank: number; total: number }) {
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
  if (rank === 0 || total === 0) return null;
  return (
    <div className="flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500">
      {medal && <span aria-hidden="true">{medal}</span>}
      <span className="font-mono">
        <span className="text-gray-700 dark:text-gray-200 font-semibold">#{rank}</span>
        {' '}of {total.toLocaleString()}
      </span>
    </div>
  );
}

// ── Tier badge ────────────────────────────────────────────────────────────────

export function TierBadge({ tier }: { tier: Tier }) {
  const cfg = TIER_CONFIG[tier];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold
        ring-1 ${cfg.bg} ${cfg.color} ${cfg.ring}`}
      aria-label={`Current tier: ${cfg.label}`}
    >
      {tier === 'T3' && <span aria-hidden="true">🏆</span>}
      {cfg.label}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export interface ReputationScoreCardProps {
  score: number;
  rank: number;
  totalContributors: number;
  tier: Tier;
  loading?: boolean;
  className?: string;
}

export function ReputationScoreCard({
  score,
  rank,
  totalContributors,
  tier,
  loading = false,
  className = '',
}: ReputationScoreCardProps) {
  const cfg = TIER_CONFIG[tier];

  if (loading) {
    return (
      <div
        className={`rounded-2xl border border-white/10 bg-surface-50 p-6 flex flex-col gap-4 ${className}`}
        aria-busy="true"
        aria-label="Loading reputation score"
      >
        <div className="flex items-start justify-between">
          <Skeleton height="3.5rem" width="10rem" rounded="lg" />
          <Skeleton height="1.5rem" width="5rem" rounded="full" />
        </div>
        <Skeleton height="1rem" width="8rem" rounded="md" />
        <Skeleton height="0.875rem" width="6rem" rounded="md" />
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border border-white/10 bg-surface-50 p-6 flex flex-col gap-3
        shadow-lg ${cfg.glow} ${className}`}
      role="region"
      aria-label="Reputation score"
    >
      {/* Score + tier row */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-gray-500 mb-1">
            Reputation Score
          </p>
          <p
            className={`text-5xl font-black tabular-nums leading-none ${cfg.color}`}
            aria-label={`${score.toLocaleString()} reputation points`}
          >
            {score.toLocaleString()}
          </p>
        </div>
        <TierBadge tier={tier} />
      </div>

      {/* Rank */}
      <RankBadge rank={rank} total={totalContributors} />

      {/* Divider */}
      <div className="h-px bg-white/5" />

      {/* Label row */}
      <p className="text-xs text-gray-600 dark:text-gray-500 font-mono">
        REP · SolFoundry Contributor
      </p>
    </div>
  );
}

export default ReputationScoreCard;
