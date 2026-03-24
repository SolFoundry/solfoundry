/**
 * ReputationPanel — composite layout assembling all reputation widgets:
 *   - ReputationScoreCard
 *   - TierProgressIndicator
 *   - ReputationHistoryChart
 *   - ReputationBreakdown
 *   - Recent Events feed (with hover detail tooltips)
 *
 * Responsive: single column on mobile, two columns on md+.
 * @module components/reputation/ReputationPanel
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useReputation } from '../../hooks/useReputation';
import { ReputationScoreCard } from './ReputationScoreCard';
import { ReputationHistoryChart } from './ReputationHistoryChart';
import { ReputationBreakdown } from './ReputationBreakdown';
import { TierProgressIndicator } from './TierProgressIndicator';
import type { ReputationEvent } from '../../types/reputation';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format ISO date to human-readable. */
function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ── Events feed ───────────────────────────────────────────────────────────────

const TIER_DOT: Record<string, string> = {
  T1: 'bg-sky-400',
  T2: 'bg-solana-purple',
  T3: 'bg-solana-green',
};

function EventRow({ event }: { event: ReputationEvent }) {
  const [showDetail, setShowDetail] = useState(false);

  return (
    <li
      className="relative flex items-start gap-3 py-2.5 border-b border-white/5 last:border-0
        cursor-default group"
      onMouseEnter={() => setShowDetail(true)}
      onMouseLeave={() => setShowDetail(false)}
      onFocus={() => setShowDetail(true)}
      onBlur={() => setShowDetail(false)}
      tabIndex={0}
      aria-label={`${event.reason} on ${fmtDate(event.date)}: +${event.delta} reputation`}
    >
      {/* Tier colour dot */}
      <span
        className={`mt-1 w-2 h-2 rounded-full shrink-0 ${TIER_DOT[event.tier] ?? 'bg-gray-500'}`}
        aria-hidden="true"
      />

      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-300 truncate">{event.reason}</p>
        <p className="text-xs text-gray-600 mt-0.5 font-mono">{fmtDate(event.date)}</p>
      </div>

      {/* Delta badge */}
      <span className="text-sm font-mono font-bold text-solana-green shrink-0">
        +{event.delta}
      </span>

      {/* Hover tooltip */}
      {showDetail && (
        <div
          className="absolute right-0 top-full mt-1 z-20
            bg-surface-100 border border-white/10 rounded-xl px-3 py-2
            text-xs shadow-xl whitespace-nowrap pointer-events-none"
          role="tooltip"
        >
          <div className="font-semibold text-gray-200 mb-1">{event.reason}</div>
          <div className="text-gray-400">
            <span className="text-solana-green font-mono">+{event.delta} REP</span>
            {' '}· {event.tier} bounty · {fmtDate(event.date)}
          </div>
          {event.bountyId && (
            <div className="text-gray-600 mt-0.5">ID: {event.bountyId}</div>
          )}
        </div>
      )}
    </li>
  );
}

function EventsFeed({
  events,
  loading,
}: {
  events: ReputationEvent[];
  loading: boolean;
}) {
  const shown = events.slice(0, 10);

  return (
    <div className="rounded-2xl border border-white/10 bg-surface-50 p-5">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Recent Activity
      </h3>

      {loading ? (
        <ul className="space-y-2.5" aria-busy="true" aria-label="Loading recent activity">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="flex items-center gap-3 py-1">
              <span className="w-2 h-2 rounded-full bg-white/10 shrink-0" />
              <div className="flex-1 h-3 rounded bg-white/5 animate-pulse" />
              <div className="w-8 h-3 rounded bg-white/5 animate-pulse" />
            </li>
          ))}
        </ul>
      ) : shown.length === 0 ? (
        <p className="text-sm text-gray-600 py-4 text-center">No activity yet</p>
      ) : (
        <ul aria-label="Reputation events">
          {shown.map(ev => (
            <EventRow key={ev.id} event={ev} />
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Leaderboard rank teaser ───────────────────────────────────────────────────

function LeaderboardTeaser({
  rank,
  total,
  username,
}: {
  rank: number;
  total: number;
  username: string;
}) {
  if (rank === 0) return null;
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
  return (
    <div className="rounded-2xl border border-white/10 bg-surface-50 p-4 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-2">
        {medal && <span className="text-2xl" aria-hidden="true">{medal}</span>}
        <div>
          <p className="text-xs text-gray-500 font-mono uppercase tracking-wider">
            Leaderboard Rank
          </p>
          <p className="text-xl font-black tabular-nums text-gray-100">
            #{rank}
            <span className="text-sm font-normal text-gray-500 ml-1.5">
              of {total.toLocaleString()}
            </span>
          </p>
        </div>
      </div>
      <Link
        to="/leaderboard"
        className="text-xs font-medium text-solana-purple hover:text-solana-green transition-colors
          px-3 py-1.5 rounded-lg border border-solana-purple/20 hover:border-solana-green/30"
        aria-label={`View ${username} on the leaderboard`}
      >
        View leaderboard →
      </Link>
    </div>
  );
}

// ── Main ReputationPanel ──────────────────────────────────────────────────────

export interface ReputationPanelProps {
  username: string;
  className?: string;
}

export function ReputationPanel({ username, className = '' }: ReputationPanelProps) {
  const { reputation: rep, loading, error } = useReputation(username);

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center" role="alert">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Top row: score card + leaderboard teaser */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ReputationScoreCard
          score={rep?.score ?? 0}
          rank={rep?.rank ?? 0}
          totalContributors={rep?.totalContributors ?? 0}
          tier={rep?.tier ?? 'T1'}
          loading={loading}
        />
        <div className="flex flex-col gap-4">
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-surface-50 h-full animate-pulse" />
          ) : rep && (
            <LeaderboardTeaser
              rank={rep.rank}
              total={rep.totalContributors}
              username={username}
            />
          )}
        </div>
      </div>

      {/* History chart — full width */}
      <ReputationHistoryChart
        history={rep?.history ?? []}
        events={rep?.events ?? []}
        loading={loading}
      />

      {/* Two-column: breakdown + tier progress */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ReputationBreakdown
          breakdown={rep?.breakdown ?? {
            t1Completions: 0,
            t2Completions: 0,
            t3Completions: 0,
            avgReviewScore: 0,
            reviewCount: 0,
            streak: 0,
          }}
          loading={loading}
        />
        <TierProgressIndicator
          tier={rep?.tier ?? 'T1'}
          t1Completions={rep?.breakdown.t1Completions ?? 0}
          t2Completions={rep?.breakdown.t2Completions ?? 0}
          t3Completions={rep?.breakdown.t3Completions ?? 0}
          loading={loading}
        />
      </div>

      {/* Events feed — full width */}
      <EventsFeed events={rep?.events ?? []} loading={loading} />
    </div>
  );
}

export default ReputationPanel;
