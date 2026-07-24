import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { PageLayout } from '../components/layout/PageLayout';
import { PodiumCards } from '../components/leaderboard/PodiumCards';
import { LeaderboardTable } from '../components/leaderboard/LeaderboardTable';
import { useLeaderboard } from '../hooks/useLeaderboard';
import type { TimePeriod } from '../types/leaderboard';
import { fadeIn } from '../lib/animations';
import { LeaderboardRowSkeleton } from '../components/ui/Skeleton';

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
          <h1 className="font-display text-4xl font-bold text-text-primary mb-3">Leaderboard</h1>
          <p className="text-text-secondary">Top contributors ranked by bounties completed</p>
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

        {/* Loading */}
        {isLoading && (
          <div className="space-y-2 max-w-2xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border bg-forge-900 p-6 flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-forge-900 via-forge-800 to-forge-900 bg-[length:200%_100%] animate-shimmer" />
                  <div className="w-20 h-4 bg-gradient-to-r from-forge-900 via-forge-800 to-forge-900 bg-[length:200%_100%] animate-shimmer rounded" />
                  <div className="w-16 h-3 bg-gradient-to-r from-forge-900 via-forge-800 to-forge-900 bg-[length:200%_100%] animate-shimmer rounded" />
                </div>
              ))}
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <LeaderboardRowSkeleton key={i} />
            ))}
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
