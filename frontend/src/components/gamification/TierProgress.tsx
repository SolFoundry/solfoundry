import React from 'react';
import type { ContributorTier } from '../../types/gamification';
import { getTierColor, getTierBgColor, getTierLabel } from '../../types/gamification';

interface TierProgressProps {
  tier: ContributorTier;
  progress: number;
  points: number;
  nextTierPoints: number;
  compact?: boolean;
}

export function TierProgress({ tier, progress, points, nextTierPoints, compact = false }: TierProgressProps) {
  const colorClass = getTierColor(tier);
  const bgClass = getTierBgColor(tier);
  const tierLabel = getTierLabel(tier);
  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-xs font-semibold ${bgClass} ${colorClass}`}>
        <span>{tierLabel}</span>
      </div>
    );
  }
  const barColor = tier === 'platinum' ? 'bg-gradient-to-r from-purple-500 to-pink-500'
    : tier === 'gold' ? 'bg-yellow-400' : tier === 'silver' ? 'bg-zinc-400' : 'bg-orange-400';
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${colorClass}`}>{tierLabel}</span>
          <span className="text-xs text-text-muted font-mono">{points.toLocaleString()} pts</span>
        </div>
        {tier !== 'platinum' && <span className="text-xs text-text-muted font-mono">{nextTierPoints.toLocaleString()} to next</span>}
      </div>
      <div className="w-full h-1.5 bg-forge-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}