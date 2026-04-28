import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Trophy, Medal } from 'lucide-react';
import type { LeaderboardEntry } from '../../types/leaderboard';
import { staggerContainer, staggerItem, fadeInScale } from '../../lib/animations';
import { BadgeRow } from './BadgeSystem';
import { StreakBadge } from './StreakTracker';
import { TierBadge, TierProgressBar } from './TierProgress';

interface PodiumCardsProps {
  entries: LeaderboardEntry[];
}

function PodiumCard({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  const isGold = rank === 1;
  const isSilver = rank === 2;
  const isBronze = rank === 3;

  const borderClass = isGold
    ? 'border-yellow-500/30 shadow-lg shadow-yellow-500/10'
    : isSilver
    ? 'border-zinc-400/30 shadow-lg shadow-zinc-400/5'
    : 'border-orange-600/30 shadow-lg shadow-orange-600/5';

  const rankColor = isGold
    ? 'text-yellow-400'
    : isSilver
    ? 'text-zinc-400'
    : 'text-orange-500';

  const avatarBorderClass = isGold ? 'border-yellow-500/50 ring-2 ring-yellow-500/20' : isSilver ? 'border-zinc-400/50 ring-2 ring-zinc-400/20' : 'border-orange-500/50 ring-2 ring-orange-500/20';
  const avatarSize = isGold ? 'w-16 h-16' : 'w-14 h-14';
  const padding = isGold ? 'py-8 px-6' : 'py-6 px-5';

  const RankIcon = isGold ? Crown : isSilver ? Trophy : Medal;

  return (
    <motion.div
      variants={staggerItem}
      className={`relative flex flex-col items-center rounded-xl border bg-forge-900/80 backdrop-blur-sm ${borderClass} ${padding} min-w-[160px] max-w-[200px] w-full`}
    >
      {/* Crown for #1 */}
      {isGold && (
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 300 }}
        >
          <Crown className="absolute -top-5 text-yellow-400 w-7 h-7 drop-shadow-lg" />
        </motion.div>
      )}

      <span className={`absolute -top-3 font-display text-sm font-bold ${rankColor}`}>
        #{rank}
      </span>

      {/* Avatar */}
      {entry.avatarUrl ? (
        <img
          src={entry.avatarUrl}
          alt={entry.username}
          className={`${avatarSize} rounded-full border-2 ${avatarBorderClass}`}
        />
      ) : (
        <div className={`${avatarSize} rounded-full border-2 ${avatarBorderClass} bg-forge-700 flex items-center justify-center`}>
          <span className="font-display text-xl text-text-muted">{entry.username[0]?.toUpperCase()}</span>
        </div>
      )}

      {/* Tier badge */}
      <div className="mt-2">
        <TierBadge tier={entry.tier} points={entry.points} size="sm" />
      </div>

      {/* Username */}
      <span className="mt-2 font-sans text-sm font-semibold text-text-primary truncate max-w-full">
        {entry.username}
      </span>

      {/* Streak */}
      <div className="mt-1.5">
        <StreakBadge streakInfo={entry.streakInfo} streak={entry.streak} size="sm" />
      </div>

      {/* Stats */}
      <span className="mt-2 font-mono text-xs text-text-muted">{entry.bountiesCompleted} bounties</span>
      <span className="mt-1 font-mono text-lg font-semibold text-emerald">
        ${entry.earningsFndry.toLocaleString()}
      </span>

      {/* Badges */}
      <div className="mt-3">
        <BadgeRow badges={entry.badges ?? []} maxDisplay={3} size="sm" />
      </div>

      {/* Tier progress */}
      <div className="mt-3 w-full">
        <TierProgressBar tier={entry.tier} points={entry.points} />
      </div>
    </motion.div>
  );
}

export function PodiumCards({ entries }: PodiumCardsProps) {
  const top3 = entries.slice(0, 3);
  if (top3.length < 1) return null;

  // Reorder: [#2, #1, #3] for podium visual (center is tallest)
  const ordered =
    top3.length === 3
      ? [top3[1], top3[0], top3[2]]
      : top3.length === 2
      ? [top3[1], top3[0]]
      : [top3[0]];

  const ranks =
    top3.length === 3 ? [2, 1, 3] : top3.length === 2 ? [2, 1] : [1];

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="flex items-end justify-center gap-4 md:gap-6 mb-12"
    >
      {ordered.map((entry, i) => (
        <PodiumCard key={entry.username} entry={entry} rank={ranks[i]} />
      ))}
    </motion.div>
  );
}
