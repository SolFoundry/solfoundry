import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Star, Crown, Gem, Sparkles } from 'lucide-react';
import type { ContributorTier, TierName } from '../../types/leaderboard';
import { fadeInScale } from '../../lib/animations';

// ─── Tier configuration ──────────────────────────────────────────
export const TIER_CONFIG: Record<TierName, {
  level: number;
  minXP: number;
  color: string;
  gradient: string;
  glow: string;
  icon: React.ReactNode;
  ringColor: string;
  textColor: string;
}> = {
  Bronze: {
    level: 1,
    minXP: 0,
    color: 'from-orange-600 to-orange-800',
    gradient: 'linear-gradient(135deg, #92400e, #c2410c)',
    glow: 'shadow-orange-600/30',
    icon: <Shield size={14} />,
    ringColor: 'ring-orange-600/40',
    textColor: 'text-orange-400',
  },
  Silver: {
    level: 2,
    minXP: 1000,
    color: 'from-zinc-400 to-zinc-600',
    gradient: 'linear-gradient(135deg, #71717a, #a1a1aa)',
    glow: 'shadow-zinc-400/30',
    icon: <Star size={14} />,
    ringColor: 'ring-zinc-400/40',
    textColor: 'text-zinc-300',
  },
  Gold: {
    level: 3,
    minXP: 5000,
    color: 'from-yellow-400 to-yellow-700',
    gradient: 'linear-gradient(135deg, #ca8a04, #eab308)',
    glow: 'shadow-yellow-500/30',
    icon: <Crown size={14} />,
    ringColor: 'ring-yellow-500/40',
    textColor: 'text-yellow-400',
  },
  Platinum: {
    level: 4,
    minXP: 10000,
    color: 'from-cyan-400 to-blue-600',
    gradient: 'linear-gradient(135deg, #0891b2, #3b82f6)',
    glow: 'shadow-cyan-500/30',
    icon: <Gem size={14} />,
    ringColor: 'ring-cyan-500/40',
    textColor: 'text-cyan-400',
  },
  Diamond: {
    level: 5,
    minXP: 25000,
    color: 'from-violet-400 to-purple-700',
    gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
    glow: 'shadow-violet-500/30',
    icon: <Sparkles size={14} />,
    ringColor: 'ring-violet-500/40',
    textColor: 'text-violet-400',
  },
};

// ─── Helpers ─────────────────────────────────────────────────────
export function computeTier(points: number): ContributorTier {
  const tiers: TierName[] = ['Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze'];
  for (const name of tiers) {
    const cfg = TIER_CONFIG[name];
    if (points >= cfg.minXP) {
      // Find next tier
      const tierOrder: TierName[] = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
      const idx = tierOrder.indexOf(name);
      const nextTier = tierOrder[idx + 1];
      const nextMinXP = nextTier ? TIER_CONFIG[nextTier].minXP : cfg.minXP * 2;

      return {
        name,
        level: cfg.level,
        currentXP: points,
        nextTierXP: nextMinXP,
        color: cfg.textColor,
        glowColor: cfg.glow,
      };
    }
  }
  return {
    name: 'Bronze',
    level: 1,
    currentXP: points,
    nextTierXP: 1000,
    color: 'text-orange-400',
    glowColor: 'shadow-orange-600/30',
  };
}

// ─── Compact tier badge (for table rows) ─────────────────────────
interface TierBadgeProps {
  tier?: ContributorTier;
  points?: number;
  size?: 'sm' | 'md' | 'lg';
}

export function TierBadge({ tier, points, size = 'sm' }: TierBadgeProps) {
  const effectiveTier = tier ?? (points !== undefined ? computeTier(points) : undefined);
  if (!effectiveTier) return null;

  const cfg = TIER_CONFIG[effectiveTier.name];
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px] gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
    lg: 'px-3 py-1.5 text-sm gap-2',
  }[size];

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`inline-flex items-center rounded-full bg-gradient-to-r ${cfg.color} ${cfg.ringColor} ring-1 font-bold uppercase tracking-wider text-white ${sizeClasses} shadow-md ${cfg.glow}`}
    >
      {cfg.icon}
      <span>{effectiveTier.name}</span>
    </motion.div>
  );
}

// ─── Tier progress bar (for podium cards / detail) ───────────────
interface TierProgressBarProps {
  tier?: ContributorTier;
  points?: number;
}

export function TierProgressBar({ tier, points }: TierProgressBarProps) {
  const effectiveTier = tier ?? (points !== undefined ? computeTier(points) : undefined);
  if (!effectiveTier) return null;

  const cfg = TIER_CONFIG[effectiveTier.name];
  const { currentXP, nextTierXP, name } = effectiveTier;

  // Calculate progress within current tier
  const tierOrder: TierName[] = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
  const idx = tierOrder.indexOf(name);
  const prevMinXP = idx > 0 ? TIER_CONFIG[tierOrder[idx - 1]].minXP : 0;

  // For diamond (max tier), show overflow progress
  const isMaxTier = name === 'Diamond';
  const rangeXP = isMaxTier ? nextTierXP - prevMinXP : nextTierXP - prevMinXP;
  const progressInRange = isMaxTier
    ? Math.min(((currentXP - prevMinXP) / rangeXP) * 100, 100)
    : Math.min(((currentXP - prevMinXP) / rangeXP) * 100, 100);
  const progressPercent = Math.max(0, Math.min(progressInRange, 100));

  const xpToNext = nextTierXP - currentXP;

  return (
    <motion.div
      variants={fadeInScale}
      initial="initial"
      animate="animate"
      className="w-full"
    >
      {/* Tier label + XP */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <TierBadge tier={effectiveTier} size="sm" />
        </div>
        <span className="text-[11px] text-text-muted font-mono">
          {currentXP.toLocaleString()} XP
          {!isMaxTier && (
            <span className="text-text-muted/60"> / {nextTierXP.toLocaleString()} XP</span>
          )}
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative h-2 rounded-full bg-forge-700/80 overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: cfg.gradient }}
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
        />
        {/* Shimmer effect */}
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-transparent via-white/20 to-transparent"
          initial={{ width: 0, x: '-100%' }}
          animate={{ width: `${progressPercent}%`, x: ['0%', `${progressPercent}%`] }}
          transition={{ duration: 1.5, delay: 1, ease: 'easeInOut' }}
        />
      </div>

      {/* Next tier hint */}
      {!isMaxTier && (
        <div className="mt-1 flex items-center justify-between">
          <span className="text-[10px] text-text-muted">
            Next: {tierOrder[idx + 1]}
          </span>
          <span className="text-[10px] text-text-muted">
            {xpToNext > 0 ? `${xpToNext.toLocaleString()} XP to go` : 'Almost there!'}
          </span>
        </div>
      )}
      {isMaxTier && (
        <div className="mt-1 text-center">
          <span className="text-[10px] text-violet-400 font-semibold uppercase tracking-wider">
            ✨ Maximum Tier Achieved ✨
          </span>
        </div>
      )}
    </motion.div>
  );
}
