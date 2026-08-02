import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Award, Flame, TrendingUp } from 'lucide-react';
import { PageLayout } from '../components/layout/PageLayout';
import { PodiumCards } from '../components/leaderboard/PodiumCards';
import { LeaderboardTable } from '../components/leaderboard/LeaderboardTable';
import { TierProgressBar } from '../components/leaderboard/TierBadge';
import { useLeaderboard } from '../hooks/useLeaderboard';
import type { TimePeriod } from '../types/leaderboard';
import { fadeIn, staggerContainer, staggerItem } from '../lib/animations';
import { TIERS, getUserTier } from '../lib/gamification';

const PERIODS: { label: string; value: TimePeriod }[] = [
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
  { label: '90d', value: '90d' },
  { label: 'All', value: 'all' },
];

export function LeaderboardPage() {
  const [period, setPeriod] = useState<TimePeriod>('all');
  const { data: entries = [], isLoading, isError } = useLeaderboard(period);

  return (
    <PageLayout>
      <motion.div variants={fadeIn} initial="initial" animate="animate" className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-text-primary mb-3">Leaderboard</h1>
          <p className="text-text-secondary text-sm sm:text-base">Top contributors ranked by bounties completed</p>
        </div>

        {/* Time filter */}
        <div className="flex items-center justify-center mb-10">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-forge-800">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 ${
                  period === p.value
                    ? 'bg-forge-700 text-text-primary'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tier overview — gamification summary */}
        {!isLoading && entries.length > 0 && (
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="max-w-4xl mx-auto mb-10 rounded-xl border border-border bg-forge-900 p-5 sm:p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Award className="w-4 h-4 text-yellow-400" />
              <h2 className="text-sm font-semibold text-text-primary">Tier Distribution</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {TIERS.map((t) => {
                const count = entries.filter((e) => getUserTier(e.points).tier === t.tier).length;
                const totalBounties = entries
                  .filter((e) => getUserTier(e.points).tier === t.tier)
                  .reduce((sum, e) => sum + e.bountiesCompleted, 0);
                return (
                  <motion.div
                    key={t.tier}
                    variants={staggerItem}
                    className="flex flex-col items-center rounded-lg bg-forge-800 p-3"
                  >
                    <span className="text-lg">{t.icon}</span>
                    <span className="mt-1 text-xs font-semibold text-text-primary">{t.label}</span>
                    <span className="mt-0.5 text-lg font-bold font-mono text-text-secondary">{count}</span>
                    <span className="text-[10px] text-text-muted">{totalBounties} bounties</span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 border-emerald border-t-transparent animate-spin" />
          </div>
        )}

        {/* Error */}
        {isError && !isLoading && (
          <div className="text-center py-12">
            <p className="text-text-muted">Could not load leaderboard data.</p>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && entries.length === 0 && (
          <div className="text-center py-12">
            <p className="text-text-muted">No contributors ranked yet for this period.</p>
          </div>
        )}

        {/* Podium + table */}
        {!isLoading && entries.length > 0 && (
          <>
            <PodiumCards entries={entries} />
            {entries.length > 3 && <LeaderboardTable entries={entries} />}
          </>
        )}
      </motion.div>
    </PageLayout>
  );
}
