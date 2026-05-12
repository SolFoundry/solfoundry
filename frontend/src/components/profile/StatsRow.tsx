import React from 'react';
import { motion } from 'framer-motion';
import { DollarSign, Trophy, Flame, GitCommit } from 'lucide-react';
import { formatCompactNumber } from '../../lib/utils';
import { staggerContainer, staggerItem } from '../../lib/animations';

export interface ContributorStats {
  totalEarnedUsdc: number;
  totalEarnedFndry: number;
  bountiesCompleted: number;
  currentStreakDays: number;
  longestStreakDays: number;
  recentActivityCount: number;
}

interface Props {
  stats: ContributorStats;
}

export function StatsRow({ stats }: Props) {
  const cards = [
    {
      key: 'earned',
      label: 'Total earned',
      Icon: DollarSign,
      tint: 'text-emerald bg-emerald-bg border-emerald-border',
      primary: stats.totalEarnedUsdc > 0 ? `$${formatCompactNumber(stats.totalEarnedUsdc)}` : '—',
      secondary:
        stats.totalEarnedFndry > 0 ? `+ ${formatCompactNumber(stats.totalEarnedFndry)} FNDRY` : 'USDC',
    },
    {
      key: 'completed',
      label: 'Bounties completed',
      Icon: Trophy,
      tint: 'text-status-info bg-status-info/10 border-status-info/20',
      primary: stats.bountiesCompleted.toString(),
      secondary: stats.bountiesCompleted === 1 ? 'submission approved' : 'submissions approved',
    },
    {
      key: 'streak',
      label: 'Contribution streak',
      Icon: Flame,
      tint: 'text-magenta bg-magenta-bg border-magenta-border',
      primary: `${stats.currentStreakDays}d`,
      secondary: stats.longestStreakDays > 0 ? `best: ${stats.longestStreakDays}d` : '—',
    },
    {
      key: 'activity',
      label: 'Recent activity',
      Icon: GitCommit,
      tint: 'text-purple bg-purple-bg border-purple-border',
      primary: stats.recentActivityCount.toString(),
      secondary: 'events · last 90d',
    },
  ];

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="grid grid-cols-2 lg:grid-cols-4 gap-3"
    >
      {cards.map(({ key, label, Icon, tint, primary, secondary }) => (
        <motion.div
          key={key}
          variants={staggerItem}
          className="rounded-xl border border-border bg-forge-900 p-4 flex items-start gap-3"
        >
          <div className={`w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0 ${tint}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-text-muted leading-none">{label}</p>
            <p className="font-mono text-xl font-bold text-text-primary mt-2 truncate">{primary}</p>
            <p className="text-[11px] text-text-muted mt-1 truncate">{secondary}</p>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
