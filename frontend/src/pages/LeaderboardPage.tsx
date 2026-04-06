import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Info } from 'lucide-react';
import { PageLayout } from '../components/layout/PageLayout';
import { PodiumCards } from '../components/leaderboard/PodiumCards';
import { LeaderboardTable } from '../components/leaderboard/LeaderboardTable';
import { useLeaderboard } from '../hooks/useLeaderboard';
import type { TimePeriod } from '../types/leaderboard';
import { fadeIn } from '../lib/animations';
import { BADGE_DEFINITIONS, TIER_THRESHOLDS, getTierColor, getTierLabel, TIER_ORDER } from '../types/gamification';

const PERIODS: { label: string; value: TimePeriod }[] = [
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
  { label: '90d', value: '90d' },
  { label: 'All', value: 'all' },
];

export function LeaderboardPage() {
  const [period, setPeriod] = useState<TimePeriod>('all');
  const { data: entries = [], isLoading, isError } = useLeaderboard(period);
  const [showGamificationInfo, setShowGamificationInfo] = useState(false);

  return (
    <PageLayout>
      <motion.div variants={fadeIn} initial="initial" animate="animate" className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center mb-6">
          <h1 className="font-display text-4xl font-bold text-text-primary mb-3">Leaderboard</h1>
          <p className="text-text-secondary">Top contributors ranked by bounties completed</p>
        </div>

        <div className="flex justify-center mb-4">
          <button onClick={() => setShowGamificationInfo(!showGamificationInfo)} className="flex items-center gap-2 text-xs text-text-muted hover:text-text-secondary transition-colors">
            <Info className="w-3.5 h-3.5" />
            {showGamificationInfo ? 'Hide' : 'Show'} tier & badge info
          </button>
        </div>

        {showGamificationInfo && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto mb-8 p-4 rounded-xl border border-border bg-forge-900/80">
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Tiers</h3>
              <div className="flex flex-wrap gap-2">
                {TIER_ORDER.map((tier) => (
                  <div key={tier} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${getTierColor(tier)} bg-forge-800/50 border-current/20`}>
                    <span>{getTierLabel(tier)}</span>
                    <span className="text-text-muted font-mono">{TIER_THRESHOLDS[tier].toLocaleString()}+ pts</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Badges</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {Object.values(BADGE_DEFINITIONS).map((badge) => (
                  <div key={badge.type} className="flex items-center gap-2 text-xs">
                    <span className="text-base">{badge.icon}</span>
                    <div>
                      <div className="text-text-primary font-medium">{badge.label}</div>
                      <div className="text-text-muted text-[10px]">{badge.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        <div className="flex items-center justify-center mb-10">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-forge-800">
            {PERIODS.map((p) => (
              <button key={p.value} onClick={() => setPeriod(p.value)} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 ${period === p.value ? 'bg-forge-700 text-text-primary' : 'text-text-muted hover:text-text-secondary'}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 border-emerald border-t-transparent animate-spin" />
          </div>
        )}

        {isError && !isLoading && (
          <div className="text-center py-12"><p className="text-text-muted">Could not load leaderboard data.</p></div>
        )}

        {!isLoading && !isError && entries.length === 0 && (
          <div className="text-center py-12"><p className="text-text-muted">No contributors ranked yet for this period.</p></div>
        )}

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