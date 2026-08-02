import React from 'react';
import { motion } from 'framer-motion';
import { DollarSign, Award, Flame, GitPullRequest, Target, TrendingUp } from 'lucide-react';
import { staggerContainer, staggerItem } from '../../lib/animations';

interface StatsOverviewProps {
  totalEarned: number;
  earnedFndry: number;
  bountiesCompleted: number;
  submissionsMade: number;
  contributionStreak: number;
  rank?: number;
  reputation?: number;
  isLoading?: boolean;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
  accent = 'text-emerald',
  iconBg = 'bg-emerald-bg',
}: {
  icon: React.FC<{ className?: string }>;
  label: string;
  value: string | number;
  sublabel?: string;
  accent?: string;
  iconBg?: string;
}) {
  return (
    <motion.div
      variants={staggerItem}
      className="rounded-xl border border-border bg-forge-900 p-4 hover:border-border-hover transition-colors duration-200"
    >
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
          <Icon className={`w-4.5 h-4.5 ${accent}`} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-text-muted font-medium uppercase tracking-wider">{label}</p>
          <p className={`mt-1 font-mono text-lg font-bold ${accent}`}>{value}</p>
          {sublabel && (
            <p className="text-xs text-text-muted mt-0.5">{sublabel}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-forge-900 p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-forge-700" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-16 bg-forge-700 rounded" />
          <div className="h-5 w-20 bg-forge-700 rounded" />
        </div>
      </div>
    </div>
  );
}

export function StatsOverview({
  totalEarned,
  earnedFndry,
  bountiesCompleted,
  submissionsMade,
  contributionStreak,
  rank,
  reputation,
  isLoading,
}: StatsOverviewProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  const formatFndry = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  const formatUsd = (n: number) => {
    if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
  };

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"
    >
      <StatCard
        icon={DollarSign}
        label="Total Earned"
        value={formatUsd(totalEarned)}
        sublabel={earnedFndry > 0 ? `${formatFndry(earnedFndry)} FNDRY` : undefined}
        accent="text-emerald"
        iconBg="bg-emerald-bg"
      />
      <StatCard
        icon={Award}
        label="Bounties Done"
        value={bountiesCompleted}
        sublabel={`${submissionsMade} submissions`}
        accent="text-purple"
        iconBg="bg-purple-bg"
      />
      <StatCard
        icon={Flame}
        label="Streak"
        value={`${contributionStreak} days`}
        sublabel={contributionStreak > 0 ? 'Keep going!' : 'Start contributing'}
        accent="text-magenta"
        iconBg="bg-magenta-bg"
      />
      <StatCard
        icon={GitPullRequest}
        label="Rank"
        value={rank ? `#${rank}` : '—'}
        sublabel={reputation ? `${reputation} rep` : undefined}
        accent="text-status-info"
        iconBg="bg-emerald-bg"
      />
      <StatCard
        icon={Target}
        label="Top Skills"
        value="—"
        accent="text-text-muted"
        iconBg="bg-forge-700"
      />
      <StatCard
        icon={TrendingUp}
        label="Activity"
        value={submissionsMade + bountiesCompleted}
        sublabel="Total contributions"
        accent="text-emerald"
        iconBg="bg-emerald-bg"
      />
    </motion.div>
  );
}