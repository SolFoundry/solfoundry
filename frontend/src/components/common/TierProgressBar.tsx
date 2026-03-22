import React, { useState } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface TierProgressBarProps {
  /** Number of merged Tier-1 bounties */
  completedT1: number;
  /** Number of merged Tier-2 bounties */
  completedT2: number;
  /** Number of merged Tier-3 bounties */
  completedT3: number;
  className?: string;
}

type Tier = 'T1' | 'T2' | 'T3';

// ============================================================================
// Unlock logic
// ============================================================================

/**
 * Returns the contributor's current highest unlocked tier.
 *
 * Rules (from the bounty spec):
 *   T2 unlock: 4 merged T1s
 *   T3 unlock: 3 merged T2s  OR  (5+ T1s AND 1+ T2)
 */
function getCurrentTier(t1: number, t2: number, t3: number): Tier {
  const t3Unlocked = t3 > 0 || t2 >= 3 || (t1 >= 5 && t2 >= 1);
  if (t3Unlocked) return 'T3';
  const t2Unlocked = t1 >= 4;
  if (t2Unlocked) return 'T2';
  return 'T1';
}

// ============================================================================
// Tooltip helpers
// ============================================================================

const TOOLTIPS = {
  t1tot2: (t1: number) =>
    t1 >= 4
      ? 'T2 unlocked ✓ (4 T1 merges)'
      : `${4 - t1} more T1 merge${4 - t1 === 1 ? '' : 's'} needed to unlock T2`,
  t2tot3: (t1: number, t2: number) => {
    const path1 = t2 >= 3;
    const path2 = t1 >= 5 && t2 >= 1;
    if (path1 || path2) return 'T3 unlocked ✓';
    const lines = [`Path A: ${Math.max(0, 3 - t2)} more T2 merge${3 - t2 === 1 ? '' : 's'}`];
    lines.push(`Path B: ${Math.max(0, 5 - t1)} more T1 + ${Math.max(0, 1 - t2)} T2 merge`);
    return lines.join(' | ');
  },
};

// ============================================================================
// Sub-components
// ============================================================================

interface MilestoneProps {
  label: string;
  isActive: boolean;
  isComplete: boolean;
  tooltip: string;
}

function Milestone({ label, isActive, isComplete, tooltip }: MilestoneProps) {
  const [showTip, setShowTip] = useState(false);

  return (
    <div
      className="relative flex flex-col items-center gap-1"
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
      onFocus={() => setShowTip(true)}
      onBlur={() => setShowTip(false)}
    >
      {/* Marker circle */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center border-2 z-10
          transition-all duration-300 cursor-default
          ${isComplete
            ? 'bg-solana-green border-solana-green text-gray-900'
            : isActive
              ? 'bg-solana-purple border-solana-purple text-white ring-4 ring-solana-purple/30 shadow-lg shadow-solana-purple/30'
              : 'bg-surface-100 border-white/20 text-gray-500'
          }`}
        aria-label={`${label}${isActive ? ' (current)' : isComplete ? ' (unlocked)' : ' (locked)'}`}
        tabIndex={0}
        role="img"
      >
        {isComplete && !isActive ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        ) : (
          <span className="text-xs font-bold">{label}</span>
        )}
      </div>

      {/* Label */}
      <span className={`text-xs font-mono font-semibold ${isActive ? 'text-solana-purple' : isComplete ? 'text-solana-green' : 'text-gray-600'}`}>
        {label}
      </span>

      {/* Tooltip */}
      {showTip && (
        <div
          className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-20
                     bg-surface-100 border border-white/10 rounded-lg px-3 py-2
                     text-xs text-gray-300 whitespace-nowrap shadow-xl pointer-events-none"
          role="tooltip"
        >
          {tooltip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0
                          border-l-4 border-r-4 border-t-4
                          border-l-transparent border-r-transparent border-t-white/10" />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TierProgressBar Component
// ============================================================================

/**
 * TierProgressBar — Visual progress bar showing contributor tier advancement.
 *
 * Shows 3 milestone markers: T1 → T2 → T3.
 * The filled track represents overall progress.
 * Current tier is highlighted with a glow effect.
 * Tooltips on hover show exact requirements for next tier.
 */
export function TierProgressBar({ completedT1, completedT2, completedT3, className = '' }: TierProgressBarProps) {
  const currentTier = getCurrentTier(completedT1, completedT2, completedT3);

  // Track fill percentage: T1=0%, T2=50%, T3=100%
  const fillPercent = currentTier === 'T1' ? Math.min(50, (completedT1 / 4) * 50)
    : currentTier === 'T2' ? 50 + Math.min(50, (completedT2 / 3) * 50)
    : 100;

  const t2Unlocked = currentTier === 'T2' || currentTier === 'T3';
  const t3Unlocked = currentTier === 'T3';

  return (
    <div className={`w-full font-mono ${className}`} aria-label={`Tier progress: currently ${currentTier}`} role="progressbar" aria-valuenow={fillPercent} aria-valuemin={0} aria-valuemax={100}>
      {/* Stats row */}
      <div className="flex items-center justify-between mb-3 text-xs text-gray-500">
        <span>T1 merges: <strong className="text-gray-300">{completedT1}</strong></span>
        <span>T2 merges: <strong className="text-gray-300">{completedT2}</strong></span>
        <span>T3 merges: <strong className="text-gray-300">{completedT3}</strong></span>
      </div>

      {/* Progress track + milestones */}
      <div className="relative flex items-center justify-between">
        {/* Background track */}
        <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-1.5 bg-white/10 rounded-full z-0" />

        {/* Filled track */}
        <div
          className="absolute left-4 top-1/2 -translate-y-1/2 h-1.5 rounded-full z-0
                     bg-gradient-to-r from-solana-purple to-solana-green transition-all duration-500"
          style={{ width: `calc(${fillPercent}% - 2rem)` }}
        />

        {/* Milestone markers */}
        <Milestone
          label="T1"
          isActive={currentTier === 'T1'}
          isComplete={t2Unlocked}
          tooltip={TOOLTIPS.t1tot2(completedT1)}
        />
        <Milestone
          label="T2"
          isActive={currentTier === 'T2'}
          isComplete={t3Unlocked}
          tooltip={TOOLTIPS.t2tot3(completedT1, completedT2)}
        />
        <Milestone
          label="T3"
          isActive={currentTier === 'T3'}
          isComplete={false}
          tooltip={t3Unlocked ? 'Maximum tier reached 🏆' : TOOLTIPS.t2tot3(completedT1, completedT2)}
        />
      </div>

      {/* Progress sub-labels */}
      <div className="flex items-center justify-between mt-3 text-xs">
        <span className="text-gray-600">{completedT1}/4 T1</span>
        <span className="text-gray-600">{completedT2}/3 T2</span>
        <span className={t3Unlocked ? 'text-solana-green font-semibold' : 'text-gray-600'}>
          {t3Unlocked ? '🏆 Max tier' : 'T3 locked'}
        </span>
      </div>
    </div>
  );
}

export default TierProgressBar;
