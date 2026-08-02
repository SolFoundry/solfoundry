import React from 'react';
import { motion } from 'framer-motion';
import { getBadgeDef, type BadgeId } from '../../lib/gamification';
import { staggerItem } from '../../lib/animations';

interface BadgeDisplayProps {
  badgeIds: string[];
  max?: number;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP = {
  sm: 'w-5 h-5 text-[10px]',
  md: 'w-7 h-7 text-xs',
  lg: 'w-9 h-9 text-sm',
};

const TIER_BORDER: Record<string, string> = {
  bronze: 'border-yellow-700/50',
  silver: 'border-zinc-400/50',
  gold: 'border-yellow-500/50',
};

export function BadgeDisplay({ badgeIds, max = 5, size = 'sm' }: BadgeDisplayProps) {
  const visible = badgeIds.slice(0, max);
  const overflow = badgeIds.length - max;

  if (!badgeIds.length) return null;

  return (
    <div className="flex items-center gap-1">
      {visible.map((id) => {
        const def = getBadgeDef(id as BadgeId);
        if (!def) return null;
        return (
          <motion.span
            key={id}
            variants={staggerItem}
            className={`inline-flex items-center justify-center rounded-full ${SIZE_MAP[size]} border ${TIER_BORDER[def.tier]} bg-forge-800 cursor-help select-none`}
            title={`${def.label}: ${def.description}`}
          >
            {def.icon}
          </motion.span>
        );
      })}
      {overflow > 0 && (
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-forge-800 text-[10px] text-text-muted font-mono">
          +{overflow}
        </span>
      )}
    </div>
  );
}

interface BadgeTooltipProps {
  badgeIds: string[];
}

export function BadgeTooltip({ badgeIds }: BadgeTooltipProps) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-text-primary">Badges</p>
      {badgeIds.map((id) => {
        const def = getBadgeDef(id as BadgeId);
        if (!def) return null;
        return (
          <div key={id} className="flex items-center gap-2 text-xs text-text-secondary">
            <span>{def.icon}</span>
            <span className="font-medium">{def.label}</span>
            <span className="text-text-muted">— {def.description}</span>
          </div>
        );
      })}
    </div>
  );
}