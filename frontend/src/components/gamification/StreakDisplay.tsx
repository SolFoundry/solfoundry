import React from 'react';
import { Flame, Zap } from 'lucide-react';

interface StreakDisplayProps {
  streak: number;
  size?: 'sm' | 'md' | 'lg';
}

const STREAK_THRESHOLDS = [
  { days: 30, label: 'Legendary', color: 'text-purple-400', glow: true },
  { days: 14, label: 'On Fire', color: 'text-orange-400', glow: true },
  { days: 7, label: 'Hot', color: 'text-yellow-400', glow: false },
  { days: 3, label: 'Warming Up', color: 'text-amber-400', glow: false },
];

export function StreakDisplay({ streak, size = 'md' }: StreakDisplayProps) {
  if (!streak || streak <= 0) return <span className="text-text-muted text-xs font-mono">—</span>;
  const milestone = STREAK_THRESHOLDS.find((m) => streak >= m.days) ?? STREAK_THRESHOLDS[STREAK_THRESHOLDS.length - 1];
  const sizeClasses = { sm: 'text-xs gap-1', md: 'text-sm gap-1.5', lg: 'text-base gap-2' };
  const iconSizes = { sm: 'w-3.5 h-3.5', md: 'w-4 h-4', lg: 'w-5 h-5' };
  const IconComponent = streak >= 7 ? Flame : Zap;
  return (
    <div className={`inline-flex items-center ${sizeClasses[size]} ${milestone.color} ${milestone.glow ? 'animate-pulse-glow' : ''}`} title={`${streak}-day streak: ${milestone.label}`}>
      <IconComponent className={`${iconSizes[size]} ${streak >= 14 ? 'fill-current' : ''}`} />
      <span className="font-mono font-semibold">{streak}d</span>
    </div>
  );
}