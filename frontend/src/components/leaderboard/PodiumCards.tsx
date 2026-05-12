import React from 'react';
import { motion } from 'framer-motion';
import { Crown } from 'lucide-react';
import type { LeaderboardEntry } from '../../types/leaderboard';
import { staggerContainer, staggerItem } from '../../lib/animations';
import { enrichLeaderboardEntry } from '../../lib/gamification';
import { TierIndicator, ContributorBadge, AnimatedStreak } from './GamificationBadges';

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
    ? 'border-zinc-400/30'
    : 'border-orange-600/30';

  const rankColor = isGold
    ? 'text-yellow-400'
    : isSilver
    ? 'text-zinc-400'
    : 'text-orange-500';

  const avatarBorderClass = isGold ? 'border-yellow-500/50' : 'border-zinc-600';
  const avatarSize = isGold ? 'w-14 h-14' : 'w-12 h-12';
  const padding = isGold ? 'py-8 px-6' : 'py-6 px-6';

  const e = enrichLeaderboardEntry(entry);

  return (
    <motion.div
      variants={staggerItem}
      className={`relative flex flex-col items-center rounded-xl border bg-forge-900 ${borderClass} ${padding} min-w-[140px] md:min-w-[160px]`}
    >
      {/* Crown for #1 */}
      {isGold && (
        <Crown className="absolute -top-4 text-yellow-400 w-6 h-6 z-10" />
      )}

      <span className={`absolute -top-3 font-display text-sm font-bold ${rankColor} z-10 bg-forge-900 px-2 rounded-full border border-inherit`}>
        #{rank}
      </span>

      <div className="relative mt-2">
        {e.avatarUrl ? (
          <img
            src={e.avatarUrl}
            alt={e.username}
            className={`${avatarSize} rounded-full border-2 ${avatarBorderClass}`}
          />
        ) : (
          <div className={`${avatarSize} rounded-full border-2 ${avatarBorderClass} bg-forge-700 flex items-center justify-center`}>
            <span className="font-display text-lg text-text-muted">{e.username[0]?.toUpperCase()}</span>
          </div>
        )}
        
        {/* Absolute top badge if they have one */}
        {e.badges && e.badges.length > 0 && (
          <div className="absolute -bottom-2 -right-2">
            <ContributorBadge badge={e.badges[0]} className="w-6 h-6" />
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-col items-center gap-1">
        <span className="font-sans text-sm font-semibold text-text-primary text-center truncate max-w-[120px]">{e.username}</span>
        {e.tier && <TierIndicator tier={e.tier} className="mt-1 mb-2" />}
      </div>
      
      <div className="flex items-center justify-between w-full mt-2 px-2 border-t border-border/50 pt-3">
        <div className="flex flex-col items-start">
          <span className="font-mono text-xs text-text-muted">Bounties</span>
          <span className="font-mono text-sm font-medium text-text-primary">{e.bountiesCompleted}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="font-mono text-xs text-text-muted">Streak</span>
          <AnimatedStreak streak={e.streak ?? 0} />
        </div>
      </div>
      
      <div className="mt-3 w-full text-center bg-forge-950/50 py-1.5 rounded-md border border-border/30">
        <span className="font-mono text-sm font-semibold text-emerald">
          ${e.earningsFndry.toLocaleString()}
        </span>
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
