import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Award, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { PageLayout } from '../components/layout/PageLayout';
import { PodiumCards } from '../components/leaderboard/PodiumCards';
import { LeaderboardTable } from '../components/leaderboard/LeaderboardTable';
import { BadgeShowcase } from '../components/leaderboard/BadgeSystem';
import { StreakCard } from '../components/leaderboard/StreakTracker';
import { TierProgressBar } from '../components/leaderboard/TierProgress';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { enrichWithGamification } from '../lib/gamification';
import type { TimePeriod, LeaderboardEntry } from '../types/leaderboard';
import { fadeIn, fadeInScale, staggerContainer, staggerItem } from '../lib/animations';

const PERIODS: { label: string; value: TimePeriod }[] = [
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
  { label: '90d', value: '90d' },
  { label: 'All', value: 'all' },
];

// ─── Contributor Detail Modal ────────────────────────────────────
function ContributorDetail({ entry, onClose }: { entry: LeaderboardEntry; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="w-full max-w-md rounded-2xl border border-border bg-forge-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-4 mb-5">
          {entry.avatarUrl ? (
            <img src={entry.avatarUrl} alt="" className="w-14 h-14 rounded-full border-2 border-border/50" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-forge-700 border-2 border-border/50 flex items-center justify-center">
              <span className="font-display text-2xl text-text-muted">{entry.username[0]?.toUpperCase()}</span>
            </div>
          )}
          <div>
            <h3 className="text-lg font-semibold text-text-primary">{entry.username}</h3>
            <p className="text-sm text-text-muted">#{entry.rank} · {entry.bountiesCompleted} bounties</p>
          </div>
          <div className="ml-auto">
            <span className="font-mono text-xl font-bold text-emerald">${entry.earningsFndry.toLocaleString()}</span>
          </div>
        </div>

        {/* Tier progress */}
        <div className="mb-5">
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Tier Progress</h4>
          <TierProgressBar tier={entry.tier} points={entry.points} />
        </div>

        {/* Streak */}
        {entry.streakInfo && (
          <div className="mb-5">
            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Contribution Streak</h4>
            <StreakCard streakInfo={entry.streakInfo} />
          </div>
        )}

        {/* Badges */}
        {entry.badges && entry.badges.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
              Badges ({entry.badges.length})
            </h4>
            <BadgeShowcase badges={entry.badges} />
          </div>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          className="mt-6 w-full py-2 rounded-lg bg-forge-800 text-sm text-text-secondary hover:text-text-primary hover:bg-forge-700 transition-colors"
        >
          Close
        </button>
      </motion.div>
    </motion.div>
  );
}

export function LeaderboardPage() {
  const [period, setPeriod] = useState<TimePeriod>('all');
  const [selectedContributor, setSelectedContributor] = useState<LeaderboardEntry | null>(null);
  const { data: rawEntries = [], isLoading, isError } = useLeaderboard(period);

  // Enrich entries with gamification data
  const entries = enrichWithGamification(rawEntries);

  // Compute summary stats
  const topEntry = entries[0];
  const totalBadges = entries.reduce((sum, e) => sum + (e.badges?.length ?? 0), 0);
  const longestStreak = entries.reduce(
    (max, e) => Math.max(max, e.streakInfo?.current ?? e.streak ?? 0),
    0,
  );
  const goldCount = entries.filter((e) => e.badges?.some((b) => b.tier === 'gold')).length;

  return (
    <PageLayout>
      <motion.div variants={fadeIn} initial="initial" animate="animate" className="max-w-5xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display text-4xl font-bold text-text-primary mb-3"
          >
            Leaderboard
          </motion.h1>
          <p className="text-text-secondary">Top contributors ranked by bounties completed</p>
        </div>

        {/* Stats summary strip */}
        {entries.length > 0 && (
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8"
          >
            {[
              { label: 'Contributors', value: entries.length, icon: '👥' },
              { label: 'Badges Earned', value: totalBadges, icon: '🏅' },
              { label: 'Longest Streak', value: `${longestStreak}d`, icon: '🔥' },
              { label: 'Gold Badges', value: goldCount, icon: '✨' },
            ].map((stat) => (
              <motion.div
                key={stat.label}
                variants={staggerItem}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-forge-900 border border-border/50"
              >
                <span className="text-xl">{stat.icon}</span>
                <div>
                  <div className="font-mono text-lg font-bold text-text-primary">{stat.value}</div>
                  <div className="text-[11px] text-text-muted uppercase tracking-wider">{stat.label}</div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

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

        {/* Contributor detail modal */}
        <AnimatePresence>
          {selectedContributor && (
            <ContributorDetail
              entry={selectedContributor}
              onClose={() => setSelectedContributor(null)}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </PageLayout>
  );
}
