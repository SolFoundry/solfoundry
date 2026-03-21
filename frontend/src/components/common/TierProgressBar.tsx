import React, { useMemo } from 'react';

/**
 * TierProgressBar - Visual progress bar for tier advancement
 *
 * Features:
 * - Shows 3 tier milestones (T1, T2, T3)
 * - Progress tracking for each tier unlock
 * - Current tier highlighted
 * - Tooltip with requirements
 * - Responsive design
 * - No external dependencies
 */

export interface TierProgressBarProps {
  /** Number of completed T1 bounties */
  completedT1: number;
  /** Number of completed T2 bounties */
  completedT2: number;
  /** Number of completed T3 bounties */
  completedT3: number;
}

interface TierStatus {
  tier: 1 | 2 | 3;
  label: string;
  progress: number;
  max: number;
  isUnlocked: boolean;
  isCurrent: boolean;
  requirement: string;
}

export function TierProgressBar({ completedT1, completedT2, completedT3 }: TierProgressBarProps) {
  const tiers = useMemo<TierStatus[]>(() => {
    // T2 unlock: 4 merged T1s
    const t2Unlocked = completedT1 >= 4;
    const t1Progress = Math.min(completedT1, 4);

    // T3 unlock: 3 merged T2s OR (5+ T1s and 1+ T2)
    const t3ViaT2 = completedT2 >= 3;
    const t3ViaMixed = completedT1 >= 5 && completedT2 >= 1;
    const t3Unlocked = t3ViaT2 || t3ViaMixed;

    // T3 progress calculation
    let t3Progress = 0;
    let t3Max = 3;
    let t3Requirement = '3 T2 bounties OR (5 T1 + 1 T2)';
    if (t3ViaT2) {
      t3Progress = completedT2;
      t3Max = 3;
    } else if (t3ViaMixed) {
      t3Progress = Math.min(completedT1, 5) + Math.min(completedT2, 1);
      t3Max = 6;
    } else {
      // Show progress towards closest unlock path
      if (completedT2 >= 1) {
        t3Progress = completedT2;
        t3Max = 3;
      } else {
        t3Progress = Math.min(completedT1, 5);
        t3Max = 5;
      }
    }

    // Determine current tier
    let currentTier: 1 | 2 | 3 = 1;
    if (t3Unlocked) currentTier = 3;
    else if (t2Unlocked) currentTier = 2;

    return [
      {
        tier: 1,
        label: 'T1',
        progress: completedT1,
        max: completedT1,
        isUnlocked: true,
        isCurrent: currentTier === 1,
        requirement: 'Entry tier - open to all',
      },
      {
        tier: 2,
        label: 'T2',
        progress: t1Progress,
        max: 4,
        isUnlocked: t2Unlocked,
        isCurrent: currentTier === 2,
        requirement: '4 T1 bounties required',
      },
      {
        tier: 3,
        label: 'T3',
        progress: t3Progress,
        max: t3Max,
        isUnlocked: t3Unlocked,
        isCurrent: currentTier === 3,
        requirement: t3Requirement,
      },
    ];
  }, [completedT1, completedT2, completedT3]);

  const totalProgress = useMemo(() => {
    if (tiers[2].isUnlocked) return 100;
    if (tiers[1].isUnlocked) {
      return 66 + (tiers[2].progress / tiers[2].max) * 34;
    }
    return 33 + (tiers[1].progress / tiers[1].max) * 33;
  }, [tiers]);

  return (
    <div className="w-full">
      {/* Tier badges row */}
      <div className="flex justify-between mb-2">
        {tiers.map((tier) => (
          <div
            key={tier.tier}
            className={`
              relative group
              px-3 py-1.5 rounded-lg font-bold text-sm
              transition-all duration-200
              ${tier.isCurrent
                ? 'bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white shadow-lg shadow-[#9945FF]/30'
                : tier.isUnlocked
                  ? 'bg-[#14F195]/20 text-[#14F195]'
                  : 'bg-gray-800 text-gray-500'
              }
            `}
          >
            {tier.label}
            {tier.isCurrent && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#14F195] rounded-full animate-pulse" />
            )}
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-xs text-gray-300 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 border border-white/10">
              {tier.requirement}
              <div className="text-gray-500 mt-1">
                {tier.isUnlocked ? '✓ Unlocked' : `${tier.progress}/${tier.max}`}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="relative h-3 bg-gray-800 rounded-full overflow-hidden">
        {/* Progress fill */}
        <div
          className="h-full bg-gradient-to-r from-[#9945FF] to-[#14F195] transition-all duration-500"
          style={{ width: `${totalProgress}%` }}
        />
        
        {/* Milestone markers */}
        <div className="absolute inset-0 flex">
          <div className="w-1/3 border-r border-gray-700" />
          <div className="w-1/3 border-r border-gray-700" />
          <div className="w-1/3" />
        </div>
      </div>

      {/* Stats row */}
      <div className="flex justify-between mt-3 text-sm">
        <div className="text-gray-400">
          <span className="text-[#14F195] font-bold">{completedT1}</span> T1
        </div>
        <div className="text-gray-400">
          <span className="text-[#9945FF] font-bold">{completedT2}</span> T2
        </div>
        <div className="text-gray-400">
          <span className="text-amber-400 font-bold">{completedT3}</span> T3
        </div>
      </div>
    </div>
  );
}

export default TierProgressBar;