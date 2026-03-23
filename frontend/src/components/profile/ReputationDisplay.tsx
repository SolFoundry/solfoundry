/**
 * ReputationDisplay — rich visual component for contributor reputation score.
 *
 * Shows:
 * - Reputation tier (Bronze / Silver / Gold / Diamond) with color coding
 * - Animated circular progress ring
 * - Rank among all contributors
 * - Score breakdown tooltip
 *
 * No external dependencies — React + Tailwind only.
 */
import { useMemo, useState } from 'react';

interface ReputationDisplayProps {
  /** Raw reputation score (0-100) */
  score: number;
  /** Rank among all contributors (1 = top) */
  rank?: number;
  /** Total number of contributors for rank context */
  totalContributors?: number;
  /** Compact mode — no breakdown, just ring + tier */
  compact?: boolean;
}

type ReputationTier = 'Bronze' | 'Silver' | 'Gold' | 'Diamond';

interface TierInfo {
  name: ReputationTier;
  min: number;
  color: string;
  ringColor: string;
  bgColor: string;
  icon: string;
}

const TIERS: TierInfo[] = [
  { name: 'Diamond', min: 90, color: 'text-cyan-400', ringColor: 'stroke-cyan-400', bgColor: 'bg-cyan-400/10', icon: '💎' },
  { name: 'Gold', min: 70, color: 'text-yellow-400', ringColor: 'stroke-yellow-400', bgColor: 'bg-yellow-400/10', icon: '🥇' },
  { name: 'Silver', min: 40, color: 'text-gray-300', ringColor: 'stroke-gray-300', bgColor: 'bg-gray-300/10', icon: '🥈' },
  { name: 'Bronze', min: 0, color: 'text-amber-600', ringColor: 'stroke-amber-600', bgColor: 'bg-amber-600/10', icon: '🥉' },
];

function getTier(score: number): TierInfo {
  return TIERS.find((t) => score >= t.min) ?? TIERS[TIERS.length - 1];
}

function nextTier(current: TierInfo): TierInfo | null {
  const idx = TIERS.indexOf(current);
  return idx > 0 ? TIERS[idx - 1] : null;
}

/** SVG circular progress ring */
function ScoreRing({ score, tier, size = 80 }: { score: number; tier: TierInfo; size?: number }) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-200 dark:text-gray-700"
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={tier.ringColor}
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
        />
      </svg>
      {/* Score text in center */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-xl font-bold ${tier.color}`}>{score}</span>
      </div>
    </div>
  );
}

export function ReputationDisplay({ score, rank, totalContributors, compact = false }: ReputationDisplayProps) {
  const tier = useMemo(() => getTier(score), [score]);
  const next = useMemo(() => nextTier(tier), [tier]);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const progressToNext = next ? ((score - tier.min) / (next.min - tier.min)) * 100 : 100;

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <ScoreRing score={score} tier={tier} size={48} />
        <div>
          <span className={`text-sm font-semibold ${tier.color}`}>
            {tier.icon} {tier.name}
          </span>
          {rank && (
            <p className="text-xs text-gray-500 dark:text-gray-400">#{rank}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-gray-200 dark:border-white/5 p-5 shadow-sm dark:shadow-none ${tier.bgColor}`}
      onMouseEnter={() => setShowBreakdown(true)}
      onMouseLeave={() => setShowBreakdown(false)}
    >
      <div className="flex items-center gap-5">
        <ScoreRing score={score} tier={tier} />

        <div className="flex-1 min-w-0 space-y-2">
          {/* Tier label */}
          <div className="flex items-center gap-2">
            <span className="text-lg">{tier.icon}</span>
            <span className={`text-lg font-bold ${tier.color}`}>{tier.name}</span>
            {rank && (
              <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
                Rank #{rank}{totalContributors ? ` of ${totalContributors}` : ''}
              </span>
            )}
          </div>

          {/* Progress to next tier */}
          {next && (
            <div>
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                <span>{tier.name}</span>
                <span>{next.name} ({next.min}+)</span>
              </div>
              <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${tier.ringColor.replace('stroke-', 'bg-')}`}
                  style={{ width: `${Math.min(progressToNext, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {next.min - score} points to {next.name}
              </p>
            </div>
          )}

          {next === null && (
            <p className="text-xs text-gray-400">Maximum tier reached 🎉</p>
          )}
        </div>
      </div>

      {/* Tooltip-style breakdown on hover */}
      {showBreakdown && (
        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-white/10 grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Code Quality</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{Math.round(score * 0.4)}/40</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Reliability</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{Math.round(score * 0.35)}/35</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Community</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{Math.round(score * 0.25)}/25</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReputationDisplay;
