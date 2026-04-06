import React from 'react';
import { motion } from 'framer-motion';
import { Crown } from 'lucide-react';
import type { LeaderboardEntry } from '../../types/leaderboard';
import { staggerContainer, staggerItem } from '../../lib/animations';
import { BadgeDisplay } from '../gamification/BadgeDisplay';
import { StreakDisplay } from '../gamification/StreakDisplay';
import { TierProgress } from '../gamification/TierProgress';
import { deriveBadges, computeTierProgress } from '../../types/gamification';

interface PodiumCardsProps {
  entries: LeaderboardEntry[];
}

function PodiumCard({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  const isGold = rank === 1;
  const isSilver = rank === 2;
  const isBronze = rank === 3;
  const borderClass = isGold ? 'border-yellow-500/30 shadow-lg shadow-yellow-500/10' : isSilver ? 'border-zinc-400/30' : 'border-orange-600/30';
  const rankColor = isGold ? 'text-yellow-400' : isSilver ? 'text-zinc-400' : 'text-orange-500';
  const avatarBorderClass = isGold ? 'border-yellow-500/50' : 'border-zinc-600';
  const avatarSize = isGold ? 'w-14 h-14' : 'w-12 h-12';
  const padding = isGold ? 'py-8 px-6' : 'py-6 px-6';
  const badges = deriveBadges(entry);
  const { tier, progress, nextTierPoints } = computeTierProgress(entry.points);

  return (
    <motion.div variants={staggerItem} className={`relative flex flex-col items-center rounded-xl border bg-forge-900 ${borderClass} ${padding} min-w-[160px]`}>
      {isGold && <Crown className="absolute -top-4 text-yellow-400 w-6 h-6" />}
      <span className={`absolute -top-3 font-display text-sm font-bold ${rankColor}`}>#{rank}</span>
      {entry.avatarUrl ? (
        <img src={entry.avatarUrl} alt={entry.username} className={`${avatarSize} rounded-full border-2 ${avatarBorderClass}`} />
      ) : (
        <div className={`${avatarSize} rounded-full border-2 ${avatarBorderClass} bg-forge-700 flex items-center justify-center`}>
          <span className="font-display text-lg text-text-muted">{entry.username[0]?.toUpperCase()}</span>
        </div>
      )}
      <span className="mt-2 font-sans text-sm font-semibold text-text-primary">{entry.username}</span>
      {badges.length > 0 && (
        <div className="mt-1"><BadgeDisplay badges={badges} size="sm" maxVisible={4} /></div>
      )}
      <span className="mt-1 font-mono text-xs text-text-muted">{entry.bountiesCompleted} bounties</span>
      {entry.streak && entry.streak > 0 && (
        <div className="mt-1"><StreakDisplay streak={entry.streak} size="sm" /></div>
      )}
      <span className="mt-1 font-mono text-lg font-semibold text-emerald">${entry.earningsFndry.toLocaleString()}</span>
      <div className="mt-1.5"><TierProgress tier={tier} progress={progress} points={entry.points} nextTierPoints={nextTierPoints} compact /></div>
    </motion.div>
  );
}

export function PodiumCards({ entries }: PodiumCardsProps) {
  const top3 = entries.slice(0, 3);
  if (top3.length < 1) return null;
  const ordered = top3.length === 3 ? [top3[1], top3[0], top3[2]] : top3.length === 2 ? [top3[1], top3[0]] : [top3[0]];
  const ranks = top3.length === 3 ? [2, 1, 3] : top3.length === 2 ? [2, 1] : [1];
  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="flex items-end justify-center gap-4 md:gap-6 mb-12">
      {ordered.map((entry, i) => <PodiumCard key={entry.username} entry={entry} rank={ranks[i]} />)}
    </motion.div>
  );
}