/**
 * TierProgressBar — Shows a contributor's tier advancement progress.
 * Displays how many T1/T2 bounties have been completed and what is needed
 * to unlock the next tier.
 *
 * Tier unlock rules:
 *   T1 → T2: 4 merged T1s (X/4)
 *   T2 → T3: 3 merged T2s  OR  (5+ T1s AND 1+ T2)
 *   T3:       unlocked / achievement state
 *
 * @module TierProgressBar
 */
import { useState } from 'react';
import type { TierStats } from '../types/badges';

// ─── Pure tier-state logic ────────────────────────────────────────────────────

export interface TierState {
  currentTier: 1 | 2 | 3;
  /** Progress toward T2 unlock (need 4 T1s) */
  t1Progress: { count: number; required: 4 };
  /** Whether the contributor qualifies for T2 */
  t2Eligible: boolean;
  /** Whether T3 is unlocked and via which path */
  t3Unlocked: boolean;
  /** Which T3 path was satisfied ('path-a' = 3+ T2s, 'path-b' = 5+ T1s & 1+ T2) */
  t3Path: 'path-a' | 'path-b' | null;
}

export function computeTierState(stats: TierStats): TierState {
  const { t1Merged, t2Merged } = stats;

  const t2Eligible = t1Merged >= 4;
  const t3PathA = t2Merged >= 3;
  const t3PathB = t1Merged >= 5 && t2Merged >= 1;
  const t3Unlocked = t3PathA || t3PathB;

  let currentTier: 1 | 2 | 3 = 1;
  if (t3Unlocked) {
    currentTier = 3;
  } else if (t2Eligible) {
    currentTier = 2;
  }

  return {
    currentTier,
    t1Progress: { count: t1Merged, required: 4 },
    t2Eligible,
    t3Unlocked,
    t3Path: t3PathA ? 'path-a' : t3PathB ? 'path-b' : null,
  };
}

// ── Milestone fill percentage on the track ────────────────────────────────────

function trackFillPercent(state: TierState): number {
  if (state.t3Unlocked) return 100;
  if (state.t2Eligible) {
    // Between T2 and T3 milestones — base at 50%, proportional T2 progress
    const t2BestPath = Math.min(
      state.t3Path !== null ? 1 : 0,
      1,
    );
    const t2Progress =
      state.t3Path !== null
        ? 1
        : Math.min(1, Math.max(
          // path-a: 3 T2s needed
          0,
          0,
        ));
    void t2BestPath;
    void t2Progress;
    // Simple: T2 unlocked = 50% filled; for partial T3 progress show up to 90%
    return 50;
  }
  // Between T1 and T2: 0–50%
  const ratio = Math.min(1, state.t1Progress.count / state.t1Progress.required);
  return ratio * 50;
}

// ─── Milestone node ───────────────────────────────────────────────────────────

interface MilestoneProps {
  label: string;
  tier: 1 | 2 | 3;
  isActive: boolean;
  isUnlocked: boolean;
  tooltip: string;
}

function Milestone({ label, tier, isActive, isUnlocked, tooltip }: MilestoneProps) {
  const [show, setShow] = useState(false);

  const ringClass = isActive
    ? 'ring-2 ring-offset-2 ring-offset-gray-900 ring-[#9945FF]'
    : '';

  const bgClass = isUnlocked
    ? 'bg-gradient-to-br from-[#9945FF] to-[#14F195] text-white'
    : 'bg-gray-800 border border-gray-700 text-gray-400';

  const glowStyle = isActive
    ? { boxShadow: '0 0 16px rgba(153, 69, 255, 0.55), 0 0 32px rgba(20, 241, 149, 0.2)' }
    : {};

  return (
    <div className="relative flex flex-col items-center gap-1.5">
      {/* Node circle */}
      <button
        type="button"
        className={[
          'w-10 h-10 rounded-full flex items-center justify-center',
          'font-bold text-sm select-none transition-all duration-300',
          bgClass,
          ringClass,
          'cursor-pointer focus:outline-none',
        ].join(' ')}
        style={glowStyle}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        aria-label={`Tier ${tier}: ${tooltip}`}
        data-testid={`tier-milestone-${tier}`}
      >
        {isUnlocked ? (
          <span aria-hidden>
            {tier === 1 ? '🌱' : tier === 2 ? '⚡' : '🏆'}
          </span>
        ) : (
          `T${tier}`
        )}
      </button>

      {/* Label */}
      <span className={['text-xs font-medium', isActive ? 'text-white' : 'text-gray-400'].join(' ')}>
        {label}
      </span>

      {/* Tooltip */}
      {show && (
        <div
          role="tooltip"
          className={[
            'absolute bottom-[calc(100%+0.75rem)] left-1/2 -translate-x-1/2 z-30',
            'w-max max-w-[200px] rounded-lg px-3 py-2 text-xs text-center',
            'shadow-xl border border-white/10',
            'bg-gray-900 text-gray-200',
            'animate-tooltip-reveal',
          ].join(' ')}
        >
          {tooltip}
          {/* Arrow */}
          <div
            className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 -mt-1 rotate-45 bg-gray-900 border-r border-b border-white/10"
            aria-hidden
          />
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface TierProgressBarProps {
  tierStats: TierStats;
}

export function TierProgressBar({ tierStats }: TierProgressBarProps) {
  const state = computeTierState(tierStats);
  const fill = trackFillPercent(state);

  const { t1Merged, t2Merged } = tierStats;

  // Human-readable tooltip copy
  const t1Tooltip = state.t2Eligible
    ? `T2 unlocked! (${t1Merged}/4 T1s)`
    : `Complete ${state.t1Progress.required - Math.min(t1Merged, state.t1Progress.required)} more T1 bounty${
        state.t1Progress.required - Math.min(t1Merged, state.t1Progress.required) === 1 ? '' : 's'
      } to unlock T2 (${t1Merged}/4)`;

  const t2Tooltip = state.t3Unlocked
    ? `T3 unlocked! via ${state.t3Path === 'path-a' ? '3+ T2s' : '5 T1s + 1 T2'}`
    : state.t2Eligible
      ? `Unlock T3: merge 3 T2s (${t2Merged}/3) OR reach 5 T1s + 1 T2 (${t1Merged}/5 T1s, ${t2Merged}/1 T2)`
      : 'Complete 4 T1 bounties to unlock T2';

  const t3Tooltip = state.t3Unlocked
    ? '🎉 Tier 3 achieved! You have access to the highest-reward bounties.'
    : 'Unlock T3: merge 3 T2 bounties, or complete 5 T1s and 1 T2';

  return (
    <div
      className="rounded-xl border border-white/5 bg-[#111111] p-4 sm:p-6"
      data-testid="tier-progress-bar"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg sm:text-xl font-bold text-white">Tier Progress</h2>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-[#9945FF]/10 px-3 py-1 text-sm font-semibold text-purple-300">
          <span aria-hidden>
            {state.currentTier === 1 ? '🌱' : state.currentTier === 2 ? '⚡' : '🏆'}
          </span>
          Tier {state.currentTier}
        </span>
      </div>

      {/* Progress track + milestones */}
      <div className="flex items-center gap-0">
        {/* T1 milestone */}
        <Milestone
          label={`T1 (${Math.min(t1Merged, 4)}/4)`}
          tier={1}
          isActive={state.currentTier === 1}
          isUnlocked={state.t2Eligible}
          tooltip={t1Tooltip}
        />

        {/* Track segment T1→T2 */}
        <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden mx-2">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#9945FF] to-[#14F195] transition-all duration-700"
            style={{ width: `${Math.min(100, (fill / 50) * 100)}%` }}
            data-testid="track-t1-t2"
          />
        </div>

        {/* T2 milestone */}
        <Milestone
          label={`T2 (${t2Merged})`}
          tier={2}
          isActive={state.currentTier === 2}
          isUnlocked={state.t3Unlocked}
          tooltip={t2Tooltip}
        />

        {/* Track segment T2→T3 */}
        <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden mx-2">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#9945FF] to-[#14F195] transition-all duration-700"
            style={{ width: state.t3Unlocked ? '100%' : '0%' }}
            data-testid="track-t2-t3"
          />
        </div>

        {/* T3 milestone */}
        <Milestone
          label="T3"
          tier={3}
          isActive={state.currentTier === 3}
          isUnlocked={state.t3Unlocked}
          tooltip={t3Tooltip}
        />
      </div>

      {/* Sub-text — next unlock requirements */}
      {!state.t3Unlocked && (
        <p className="mt-4 text-xs text-gray-400 text-center">
          {state.t2Eligible
            ? <>Next: T3 — merge <span className="text-white font-medium">3 T2 bounties</span> ({t2Merged}/3)&nbsp; or &nbsp;<span className="text-white font-medium">5 T1s + 1 T2</span> ({t1Merged}/5 T1s, {t2Merged}/1 T2)</>
            : <>Next: T2 — merge <span className="text-white font-medium">4 T1 bounties</span> ({t1Merged}/4)</>
          }
        </p>
      )}
      {state.t3Unlocked && (
        <p className="mt-4 text-xs text-center text-[#14F195] font-medium">
          🎉 All tiers unlocked! You have access to the highest-reward bounties.
        </p>
      )}
    </div>
  );
}

export default TierProgressBar;
