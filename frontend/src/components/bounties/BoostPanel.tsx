/**
 * BoostPanel — community reward boost UI for a bounty detail page.
 *
 * Contains:
 *   - BoostSummaryCard    : original + boosted + total prize display
 *   - BoostForm           : amount input + submit button
 *   - BoostLeaderboard    : top boosters per bounty
 *   - BoostHistory        : chronological list of contributions
 *   - Loading skeletons for all sub-sections
 *
 * @module components/bounties/BoostPanel
 */
import React, { useState } from 'react';
import { useBoost } from '../../hooks/useBoost';
import type { Boost, BoosterLeaderboardEntry } from '../../types/boost';
import { WalletAddress } from '../wallet/WalletAddress';

// ── Skeleton helper ───────────────────────────────────────────────────────────

function PulseLine({ w = 'w-full', h = 'h-3' }: { w?: string; h?: string }) {
  return <div className={`${w} ${h} rounded bg-white/5 animate-pulse`} />;
}

// ── Boost summary card ────────────────────────────────────────────────────────

function BoostSummaryCard({
  originalAmount,
  totalBoosted,
  totalAmount,
  boostCount,
  loading,
}: {
  originalAmount: number;
  totalBoosted: number;
  totalAmount: number;
  boostCount: number;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div
        className="rounded-2xl border border-white/10 bg-surface-50 p-5 space-y-3"
        aria-busy="true"
        aria-label="Loading reward summary"
      >
        <PulseLine w="w-28" h="h-3" />
        <PulseLine w="w-40" h="h-8" />
        <div className="flex gap-4">
          <PulseLine w="w-24" h="h-3" />
          <PulseLine w="w-24" h="h-3" />
        </div>
      </div>
    );
  }

  const boosted = totalBoosted > 0;

  return (
    <div
      className="rounded-2xl border border-white/10 bg-surface-50 p-5"
      role="region"
      aria-label="Reward summary"
      data-testid="boost-summary"
    >
      <p className="text-xs font-mono uppercase tracking-widest text-gray-500 mb-2">
        Total Prize Pool
      </p>
      <p className="text-4xl font-black tabular-nums text-solana-green mb-3">
        {totalAmount.toLocaleString()}{' '}
        <span className="text-xl font-semibold text-gray-400">$FNDRY</span>
      </p>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-400">
        <span>
          <span className="font-mono text-gray-200">{originalAmount.toLocaleString()}</span>
          {' '}original
        </span>
        {boosted && (
          <span>
            <span className="font-mono text-solana-purple">+{totalBoosted.toLocaleString()}</span>
            {' '}boosted{boostCount > 1 && ` (${boostCount}×)`}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Boost form ────────────────────────────────────────────────────────────────

function BoostForm({
  bountyStatus,
  minBoost,
  submitting,
  submitError,
  submitSuccess,
  onSubmit,
}: {
  bountyStatus: string;
  minBoost: number;
  submitting: boolean;
  submitError: string | null;
  submitSuccess: boolean;
  onSubmit: (amount: number) => void;
}) {
  const [amount, setAmount] = useState('');
  const canBoost = ['open', 'in_progress'].includes(bountyStatus);

  if (!canBoost) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount.replace(/,/g, ''));
    if (!isNaN(parsed)) onSubmit(parsed);
  }

  return (
    <div
      className="rounded-2xl border border-white/10 bg-surface-50 p-5"
      role="region"
      aria-label="Boost this bounty"
      data-testid="boost-form"
    >
      <h3 className="text-sm font-semibold text-gray-300 mb-1">Boost Reward</h3>
      <p className="text-xs text-gray-500 mb-4">
        Add $FNDRY to the prize pool. Minimum {minBoost.toLocaleString()} $FNDRY.
        Refunded if the bounty expires without a winner.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex gap-2">
          <label htmlFor="boost-amount" className="sr-only">
            Boost amount in $FNDRY
          </label>
          <input
            id="boost-amount"
            type="number"
            min={minBoost}
            step="100"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder={`Min ${minBoost.toLocaleString()}`}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2
              text-sm text-gray-100 placeholder-gray-600 focus:outline-none
              focus:ring-1 focus:ring-solana-purple/60"
            disabled={submitting}
            aria-label="Boost amount"
            data-testid="boost-amount-input"
          />
          <button
            type="submit"
            disabled={submitting || !amount}
            className="px-4 py-2 rounded-lg bg-solana-purple text-white text-sm font-semibold
              hover:bg-solana-purple/80 disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors shrink-0"
            data-testid="boost-submit-btn"
          >
            {submitting ? 'Boosting…' : 'Boost'}
          </button>
        </div>

        {submitError && (
          <p className="text-xs text-red-400" role="alert" data-testid="boost-error">
            {submitError}
          </p>
        )}
        {submitSuccess && (
          <p className="text-xs text-solana-green" role="status" data-testid="boost-success">
            ✓ Boost submitted successfully!
          </p>
        )}
      </form>
    </div>
  );
}

// ── Booster leaderboard ───────────────────────────────────────────────────────

function BoostLeaderboardSection({
  entries,
  loading,
}: {
  entries: BoosterLeaderboardEntry[];
  loading: boolean;
}) {
  return (
    <div
      className="rounded-2xl border border-white/10 bg-surface-50 p-5"
      role="region"
      aria-label="Boost leaderboard"
      data-testid="boost-leaderboard"
    >
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
        Top Boosters
      </h3>

      {loading ? (
        <ul className="space-y-2.5" aria-busy="true">
          {Array.from({ length: 3 }, (_, i) => (
            <li key={i} className="flex items-center gap-3">
              <PulseLine w="w-5" h="h-5" />
              <PulseLine w="flex-1" />
              <PulseLine w="w-16" />
            </li>
          ))}
        </ul>
      ) : entries.length === 0 ? (
        <p className="text-sm text-gray-600 text-center py-4">No boosts yet — be the first!</p>
      ) : (
        <ol aria-label="Booster rankings" className="space-y-2.5">
          {entries.map(entry => {
            const medal =
              entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : null;
            return (
              <li
                key={entry.booster_wallet}
                className="flex items-center gap-3 text-sm"
                aria-label={`Rank ${entry.rank}: ${entry.booster_wallet}`}
              >
                <span className="w-6 text-center font-mono text-xs text-gray-500 shrink-0">
                  {medal ?? `#${entry.rank}`}
                </span>
                <span className="flex-1 shrink-0">
                  <WalletAddress address={entry.booster_wallet} startChars={6} endChars={4} className="text-xs" />
                </span>
                <span className="font-mono font-semibold text-solana-green shrink-0">
                  {entry.total_boosted.toLocaleString()}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

// ── Boost history ─────────────────────────────────────────────────────────────

function BoostHistorySection({
  boosts,
  loading,
}: {
  boosts: Boost[];
  loading: boolean;
}) {
  const STATUS_COLOR: Record<string, string> = {
    confirmed: 'text-solana-green',
    pending: 'text-amber-400',
    refunded: 'text-gray-500 line-through',
  };

  return (
    <div
      className="rounded-2xl border border-white/10 bg-surface-50 p-5"
      role="region"
      aria-label="Boost history"
      data-testid="boost-history"
    >
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
        Boost History
      </h3>

      {loading ? (
        <ul className="space-y-3" aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="flex items-center gap-3">
              <PulseLine w="flex-1" />
              <PulseLine w="w-20" />
              <PulseLine w="w-12" />
            </li>
          ))}
        </ul>
      ) : boosts.length === 0 ? (
        <p className="text-sm text-gray-600 text-center py-4">No boosts yet</p>
      ) : (
        <ul aria-label="Boost contributions" className="space-y-3">
          {boosts.map(boost => (
            <li
              key={boost.id}
              className="flex items-center gap-3 text-sm border-b border-white/5 last:border-0 pb-3 last:pb-0"
              aria-label={`${boost.booster_wallet} boosted ${boost.amount.toLocaleString()} $FNDRY`}
            >
              <span className="flex-1 shrink-0">
                <WalletAddress address={boost.booster_wallet} startChars={6} endChars={4} className="text-xs" />
              </span>
              <span className={`font-mono font-semibold shrink-0 ${STATUS_COLOR[boost.status] ?? ''}`}>
                +{boost.amount.toLocaleString()}
              </span>
              <span className="text-xs text-gray-600 shrink-0 font-mono">
                {boost.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Main BoostPanel ───────────────────────────────────────────────────────────

export interface BoostPanelProps {
  bountyId: string;
  bountyStatus: string;
  originalAmount: number;
  /** Wallet address of the current user (for submitting boosts). */
  walletAddress?: string;
  className?: string;
}

export function BoostPanel({
  bountyId,
  bountyStatus,
  originalAmount,
  walletAddress = '',
  className = '',
}: BoostPanelProps) {
  const {
    boosts,
    leaderboard,
    summary,
    loading,
    submitting,
    submitError,
    submitSuccess,
    submitBoost,
    MIN_BOOST,
  } = useBoost(bountyId, originalAmount);

  function handleSubmit(amount: number) {
    if (!walletAddress) return;
    submitBoost(walletAddress, amount);
  }

  return (
    <div className={`space-y-4 ${className}`} data-testid="boost-panel">
      {/* Prize pool summary */}
      <BoostSummaryCard
        originalAmount={summary.original_amount}
        totalBoosted={summary.total_boosted}
        totalAmount={summary.total_amount}
        boostCount={summary.boost_count}
        loading={loading}
      />

      {/* Boost form (only for open/in_progress bounties with connected wallet) */}
      {walletAddress && (
        <BoostForm
          bountyStatus={bountyStatus}
          minBoost={MIN_BOOST}
          submitting={submitting}
          submitError={submitError}
          submitSuccess={submitSuccess}
          onSubmit={handleSubmit}
        />
      )}

      {/* Leaderboard */}
      <BoostLeaderboardSection entries={leaderboard} loading={loading} />

      {/* History */}
      <BoostHistorySection boosts={boosts} loading={loading} />
    </div>
  );
}

export default BoostPanel;
