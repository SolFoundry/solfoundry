import React from 'react';
import { motion } from 'framer-motion';
import { getUserTier, getTierProgress, type UserTier } from '../../lib/gamification';
import { staggerItem } from '../../lib/animations';

interface TierBadgeProps {
  points: number;
  tier?: string | null;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const SIZE_MAP = {
  sm: 'w-5 h-5 text-[10px]',
  md: 'w-7 h-7 text-xs',
  lg: 'w-9 h-9 text-sm',
};

const TIER_GRADIENT: Record<string, string> = {
  bronze: 'from-yellow-800 to-yellow-700',
  silver: 'from-zinc-500 to-zinc-400',
  gold: 'from-yellow-500 to-yellow-400',
  diamond: 'from-cyan-400 to-blue-300',
  master: 'from-orange-500 to-red-400',
};

export function TierBadge({ points, tier: explicitTier, size = 'sm', showLabel = false }: TierBadgeProps) {
  const tierDef = explicitTier ? getUserTier(points) : getUserTier(points);
  const { next, progress } = getTierProgress(points);

  return (
    <motion.div
      variants={staggerItem}
      className="inline-flex items-center gap-1"
      title={`${tierDef.label} (${points.toLocaleString()} pts)${next ? ` · Next: ${next.label} (${Math.round(progress * 100)}%)` : ' · Max tier'}`}
    >
      <span
        className={`inline-flex items-center justify-center rounded-full ${SIZE_MAP[size]} bg-gradient-to-br ${TIER_GRADIENT[tierDef.tier]} text-white select-none`}
      >
        {tierDef.icon}
      </span>
      {showLabel && (
        <span className="text-xs font-semibold text-text-secondary">{tierDef.label}</span>
      )}
    </motion.div>
  );
}

interface TierProgressBarProps {
  points: number;
  className?: string;
}

export function TierProgressBar({ points, className = '' }: TierProgressBarProps) {
  const { current, next, progress } = getTierProgress(points);

  if (!next) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="text-xs font-semibold text-yellow-400">{current.icon} {current.label}</span>
        <span className="text-[10px] text-text-muted">MAX TIER</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-xs font-semibold text-text-secondary">{current.icon} {current.label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-forge-800 overflow-hidden min-w-[60px]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-emerald transition-all duration-500"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-text-muted">{next.icon} {next.label}</span>
      <span className="text-[10px] text-text-muted font-mono">{Math.round(progress * 100)}%</span>
    </div>
  );
}