import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Badge, BadgeTier, BadgeType } from '../../types/leaderboard';
import { popIn } from '../../lib/animations';

// ─── Badge definitions ───────────────────────────────────────────
export const BADGE_DEFINITIONS: Record<BadgeType, { icon: string; label: string; description: string }> = {
  first_bounty:    { icon: '🏆', label: 'First Blood',     description: 'Completed first bounty' },
  speed_demon:     { icon: '⚡', label: 'Speed Demon',     description: 'Completed a bounty in record time' },
  streak_master:   { icon: '🔥', label: 'Streak Master',   description: 'Maintained a 7+ day streak' },
  high_roller:     { icon: '💎', label: 'High Roller',     description: 'Earned 10K+ FNDRY' },
  top_contributor: { icon: '🌟', label: 'Top Contributor',  description: 'Reached the top 3' },
  sharpshooter:    { icon: '🎯', label: 'Sharpshooter',    description: '100% acceptance rate (5+ bounties)' },
  team_player:     { icon: '🤝', label: 'Team Player',     description: 'Contributed to 10+ bounties' },
  veteran:         { icon: '🏅', label: 'Veteran',         description: 'Active for 90+ days' },
  code_slinger:    { icon: '💻', label: 'Code Slinger',    description: 'Merged 50+ PRs' },
  mentor:          { icon: '🎓', label: 'Mentor',          description: 'Helped 5+ newcomers' },
};

const TIER_STYLES: Record<BadgeTier, { bg: string; border: string; ring: string; glow: string }> = {
  gold:   { bg: 'bg-yellow-500/15', border: 'border-yellow-500/40', ring: 'ring-yellow-500/30', glow: 'shadow-yellow-500/20' },
  silver: { bg: 'bg-zinc-300/15',   border: 'border-zinc-400/40',   ring: 'ring-zinc-400/30',   glow: 'shadow-zinc-400/20' },
  bronze: { bg: 'bg-orange-500/15', border: 'border-orange-500/40', ring: 'ring-orange-500/30', glow: 'shadow-orange-500/20' },
};

interface BadgeItemProps {
  badge: Badge;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

export function BadgeItem({ badge, size = 'sm', showTooltip = true }: BadgeItemProps) {
  const def = BADGE_DEFINITIONS[badge.type] ?? { icon: '🏅', label: 'Badge', description: '' };
  const style = TIER_STYLES[badge.tier] ?? TIER_STYLES.bronze;

  const sizeClasses = {
    sm: 'w-7 h-7 text-sm',
    md: 'w-9 h-9 text-base',
    lg: 'w-12 h-12 text-xl',
  }[size];

  return (
    <motion.div
      variants={popIn}
      className={`relative group inline-flex items-center justify-center rounded-full ${style.bg} border ${style.border} ${sizeClasses} shadow-md ${style.glow}`}
      title={showTooltip ? `${def.label}: ${def.description}` : undefined}
    >
      <span className="select-none leading-none">{badge.icon || def.icon}</span>

      {/* Tier indicator dot */}
      <span
        className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${
          badge.tier === 'gold' ? 'bg-yellow-400' : badge.tier === 'silver' ? 'bg-zinc-400' : 'bg-orange-500'
        } ring-1 ring-forge-900`}
      />

      {/* Hover tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-lg bg-forge-800 border border-border text-xs text-text-primary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
          <span className="font-semibold">{def.label}</span>
          <span className="text-text-muted ml-1.5">{def.description}</span>
        </div>
      )}
    </motion.div>
  );
}

interface BadgeRowProps {
  badges: Badge[];
  maxDisplay?: number;
  size?: 'sm' | 'md' | 'lg';
}

export function BadgeRow({ badges, maxDisplay = 4, size = 'sm' }: BadgeRowProps) {
  if (!badges || badges.length === 0) return null;

  const visible = badges.slice(0, maxDisplay);
  const overflow = badges.length - maxDisplay;

  return (
    <div className="flex items-center -space-x-1">
      <AnimatePresence>
        {visible.map((badge, i) => (
          <motion.div
            key={`${badge.type}-${badge.tier}`}
            variants={popIn}
            initial="initial"
            animate="animate"
            transition={{ delay: i * 0.05 }}
          >
            <BadgeItem badge={badge} size={size} />
          </motion.div>
        ))}
      </AnimatePresence>
      {overflow > 0 && (
        <span className="ml-1.5 text-xs text-text-muted font-medium">+{overflow}</span>
      )}
    </div>
  );
}

// ─── Badge showcase (expanded view) ──────────────────────────────
interface BadgeShowcaseProps {
  badges: Badge[];
}

export function BadgeShowcase({ badges }: BadgeShowcaseProps) {
  if (!badges || badges.length === 0) return null;

  // Group by tier
  const grouped: Record<BadgeTier, Badge[]> = { gold: [], silver: [], bronze: [] };
  badges.forEach((b) => {
    if (grouped[b.tier]) grouped[b.tier].push(b);
  });

  return (
    <div className="space-y-3">
      {(['gold', 'silver', 'bronze'] as BadgeTier[]).map((tier) => {
        const group = grouped[tier];
        if (group.length === 0) return null;
        return (
          <div key={tier} className="flex items-center gap-2 flex-wrap">
            {group.map((badge) => (
              <BadgeItem key={`${badge.type}-${badge.tier}`} badge={badge} size="md" />
            ))}
          </div>
        );
      })}
    </div>
  );
}
