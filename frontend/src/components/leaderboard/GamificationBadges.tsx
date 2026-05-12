import React from 'react';
import { motion } from 'framer-motion';
import { Flame, Star, Shield, Zap, Award } from 'lucide-react';
import type { ContributorTier, BadgeType } from '../../lib/gamification';

interface TierIndicatorProps {
  tier: string;
  className?: string;
}

export function TierIndicator({ tier, className = '' }: TierIndicatorProps) {
  // Mapping tiers to specific styling and icons
  let Icon = Shield;
  let styleClass = 'bg-forge-800 text-text-muted border-border';
  
  switch (tier.toLowerCase()) {
    case 'novice':
      Icon = Shield;
      styleClass = 'bg-forge-800 text-text-muted border-border';
      break;
    case 'adept':
      Icon = Zap;
      styleClass = 'bg-emerald/10 text-emerald border-emerald/20';
      break;
    case 'master':
      Icon = Star;
      styleClass = 'bg-purple/10 text-purple border-purple/20';
      break;
    case 'grandmaster':
      Icon = Award;
      styleClass = 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20 shadow-[0_0_10px_rgba(234,179,8,0.2)]';
      break;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider ${styleClass} ${className}`}>
      <Icon className="w-3 h-3" />
      {tier}
    </span>
  );
}

interface ContributorBadgeProps {
  badge: string;
  className?: string;
}

export function ContributorBadge({ badge, className = '' }: ContributorBadgeProps) {
  let styleClass = '';
  
  switch (badge.toLowerCase()) {
    case 'gold':
      styleClass = 'text-yellow-400 drop-shadow-[0_0_4px_rgba(250,204,21,0.5)]';
      break;
    case 'silver':
      styleClass = 'text-zinc-300 drop-shadow-[0_0_3px_rgba(212,212,216,0.4)]';
      break;
    case 'bronze':
      styleClass = 'text-amber-600 drop-shadow-[0_0_2px_rgba(217,119,6,0.4)]';
      break;
  }

  return (
    <div title={`${badge} Contributor`} className={`flex items-center justify-center ${className}`}>
      <svg className={`w-5 h-5 ${styleClass}`} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7.5-6.3-4.8-6.3 4.8 2.3-7.5-6-4.6h7.6z" />
      </svg>
    </div>
  );
}

interface AnimatedStreakProps {
  streak: number;
  className?: string;
}

export function AnimatedStreak({ streak, className = '' }: AnimatedStreakProps) {
  if (streak <= 0) return <span className="text-text-muted">—</span>;

  const isHot = streak >= 3;
  const isOnFire = streak >= 7;

  // More intense animation for higher streaks
  const pulseAnimation = isOnFire 
    ? { scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] } 
    : isHot 
    ? { scale: [1, 1.1, 1] } 
    : {};

  const colorClass = isOnFire 
    ? 'text-status-error drop-shadow-[0_0_6px_rgba(255,82,82,0.8)]' 
    : isHot 
    ? 'text-orange-500 drop-shadow-[0_0_4px_rgba(249,115,22,0.6)]' 
    : 'text-status-warning';

  return (
    <span className={`font-mono text-sm inline-flex items-center gap-1 ${colorClass} ${className}`}>
      <motion.div
        animate={pulseAnimation}
        transition={{ duration: isOnFire ? 0.8 : 1.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <Flame className={`w-4 h-4 ${isOnFire ? 'fill-current' : ''}`} />
      </motion.div>
      <span className="font-bold">{streak}</span>
    </span>
  );
}
