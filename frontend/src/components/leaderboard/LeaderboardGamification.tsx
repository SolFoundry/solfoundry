import React from 'react';
import { Flame, Trophy, Star, Zap, Shield, Crown, Award, Target, TrendingUp } from 'lucide-react';

// Badge Types
export type BadgeType =
  | 'first_bounty'      // First bounty completed
  | 'bounty_hunter'     // 5+ bounties completed
  | 'forge_master'      // 25+ bounties completed
  | 'streak_3'          // 3-day streak
  | 'streak_7'          // 7-day streak
  | 'streak_30'         // 30-day streak
  | 'high_scorer'       // Average AI review score ≥ 8.0
  | 'speed_demon'       // Completed bounty within 24h of posting
  | 'polyglot'          // Completed bounties in 3+ languages
  | 't1_graduate'       // Unlocked T2 access
  | 't2_graduate'       // Unlocked T3 access
  | 'top_10'            // Top 10 on leaderboard
  | 'top_3'             // Top 3 on leaderboard
  | 'first_pr'          // First PR merged
  | 'generous_funder'   // Funded 5+ bounties
  | 'community_hero';   // 10+ helpful comments

export interface Badge {
  type: BadgeType;
  label: string;
  description: string;
  icon: React.ElementType;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  earnedAt?: string; // ISO date if earned
}

const BADGE_DEFINITIONS: Badge[] = [
  { type: 'first_bounty', label: 'First Blood', description: 'Completed your first bounty', icon: Target, tier: 'bronze' },
  { type: 'first_pr', label: 'Hello World', description: 'First PR merged', icon: Star, tier: 'bronze' },
  { type: 'bounty_hunter', label: 'Bounty Hunter', description: '5+ bounties completed', icon: Trophy, tier: 'silver' },
  { type: 'speed_demon', label: 'Speed Demon', description: 'Completed bounty within 24h', icon: Zap, tier: 'silver' },
  { type: 'streak_3', label: 'On Fire', description: '3-day contribution streak', icon: Flame, tier: 'bronze' },
  { type: 'streak_7', label: 'Blazing', description: '7-day contribution streak', icon: Flame, tier: 'silver' },
  { type: 'streak_30', label: 'Inferno', description: '30-day contribution streak', icon: Flame, tier: 'gold' },
  { type: 'high_scorer', label: 'Perfectionist', description: 'Average AI review score ≥ 8.0', icon: Shield, tier: 'gold' },
  { type: 'polyglot', label: 'Polyglot', description: 'Bounties in 3+ languages', icon: Award, tier: 'silver' },
  { type: 't1_graduate', label: 'T2 Unlocked', description: 'Unlocked Tier 2 access', icon: TrendingUp, tier: 'silver' },
  { type: 't2_graduate', label: 'T3 Unlocked', description: 'Unlocked Tier 3 access', icon: TrendingUp, tier: 'gold' },
  { type: 'forge_master', label: 'Forge Master', description: '25+ bounties completed', icon: Crown, tier: 'platinum' },
  { type: 'top_10', label: 'Top 10', description: 'Top 10 on leaderboard', icon: Trophy, tier: 'gold' },
  { type: 'top_3', label: 'Podium', description: 'Top 3 on leaderboard', icon: Crown, tier: 'platinum' },
  { type: 'generous_funder', label: 'Patron', description: 'Funded 5+ bounties', icon: Star, tier: 'gold' },
  { type: 'community_hero', label: 'Community Hero', description: '10+ helpful comments', icon: Shield, tier: 'silver' },
];

const tierColors: Record<string, string> = {
  bronze: 'from-amber-800 to-amber-600 text-amber-200 border-amber-700',
  silver: 'from-gray-400 to-gray-300 text-gray-700 border-gray-400',
  gold: 'from-yellow-500 to-yellow-400 text-yellow-900 border-yellow-500',
  platinum: 'from-emerald-500 to-cyan-400 text-dark-forge border-emerald-400',
};

// Badge Display Component
export function BadgeDisplay({ badge, size = 'md' }: { badge: Badge; size?: 'sm' | 'md' | 'lg' }) {
  const Icon = badge.icon;
  const isEarned = !!badge.earnedAt;
  const sizeClasses = { sm: 'w-8 h-8', md: 'w-12 h-12', lg: 'w-16 h-16' };
  const iconSizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };
  const colorClass = tierColors[badge.tier];

  return (
    <div className="flex flex-col items-center gap-1 group" title={`${badge.label}: ${badge.description}`}>
      <div className={`
        ${sizeClasses[size]} rounded-full flex items-center justify-center
        bg-gradient-to-br ${isEarned ? colorClass : 'from-gray-800 to-gray-700 text-gray-500 border-gray-700'}
        border-2 shadow-lg transition-transform group-hover:scale-110
        ${!isEarned ? 'opacity-40' : ''}
      `}>
        <Icon className={iconSizes[size]} />
      </div>
      {size !== 'sm' && (
        <span className={`text-xs font-medium ${isEarned ? 'text-text-primary' : 'text-text-muted'}`}>
          {badge.label}
        </span>
      )}
    </div>
  );
}

// Badge Grid
export function BadgeGrid({ earnedBadges }: { earnedBadges: BadgeType[] }) {
  const badges = BADGE_DEFINITIONS.map((def) => ({
    ...def,
    earnedAt: earnedBadges.includes(def.type) ? '2026-01-01' : undefined,
  }));

  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4 p-4">
      {badges.map((badge) => (
        <BadgeDisplay key={badge.type} badge={badge} size="md" />
      ))}
    </div>
  );
}

// Streak Display
export interface StreakInfo {
  current: number;  // days
  longest: number;  // days
  lastContribution: string; // ISO date
}

export function StreakDisplay({ streak }: { streak: StreakInfo }) {
  const isActive = (Date.now() - new Date(streak.lastContribution).getTime()) < 86400000 * 2;

  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-lg bg-surface-card border border-border-primary">
      {/* Flame icon with animation when active */}
      <div className={`flex items-center gap-2 ${isActive ? 'animate-pulse' : ''}`}>
        <Flame className={`w-6 h-6 ${streak.current >= 7 ? 'text-anvil-orange' : streak.current >= 3 ? 'text-tier-t2' : 'text-text-muted'}`} />
        <div>
          <p className="text-2xl font-bold text-text-primary tabular-nums">{streak.current}</p>
          <p className="text-xs text-text-muted">day streak</p>
        </div>
      </div>

      <div className="h-8 w-px bg-border-primary" />

      {/* Longest streak */}
      <div>
        <p className="text-lg font-semibold text-text-secondary tabular-nums">{streak.longest}</p>
        <p className="text-xs text-text-muted">longest</p>
      </div>

      {/* Streak badge indicators */}
      {streak.current >= 3 && (
        <div className="ml-auto flex items-center gap-1">
          {streak.current >= 3 && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-800/20 text-amber-500 border border-amber-700/30">🔥 3d</span>}
          {streak.current >= 7 && <span className="text-xs px-2 py-0.5 rounded-full bg-tier-t2/10 text-tier-t2 border border-tier-t2/20">🔥 7d</span>}
          {streak.current >= 30 && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald/10 text-emerald border border-emerald/20">🔥 30d</span>}
        </div>
      )}
    </div>
  );
}

// Tier Progression Bar
export interface TierProgress {
  t1_merged: number;   // T1 bounties merged (need 4 for T2)
  t2_merged: number;   // T2 bounties merged (need 4 for T3)
  currentTier: 1 | 2 | 3;
  reputation: number;  // 0-100
}

export function TierProgressBar({ progress }: { progress: TierProgress }) {
  const t2Progress = Math.min(progress.t1_merged / 4, 1);
  const t3Progress = Math.min(progress.t2_merged / 4, 1);
  const t2Unlocked = progress.t1_merged >= 4;
  const t3Unlocked = progress.t2_merged >= 4;

  return (
    <div className="space-y-4 p-4 rounded-lg bg-surface-card border border-border-primary">
      <h3 className="text-sm font-semibold text-text-primary">Tier Progression</h3>

      {/* T1 → T2 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-emerald font-medium">T1 → T2</span>
          <span className="text-xs text-text-muted">{progress.t1_merged}/4 merged</span>
        </div>
        <div className="h-2 bg-surface-hover rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald rounded-full transition-all duration-500"
            style={{ width: `${t2Progress * 100}%` }}
          />
        </div>
        {t2Unlocked && <p className="mt-1 text-xs text-emerald">✓ T2 Unlocked!</p>}
      </div>

      {/* T2 → T3 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-tier-t2 font-medium">T2 → T3</span>
          <span className="text-xs text-text-muted">{progress.t2_merged}/4 merged</span>
        </div>
        <div className="h-2 bg-surface-hover rounded-full overflow-hidden">
          <div
            className="h-full bg-tier-t2 rounded-full transition-all duration-500"
            style={{ width: `${t3Progress * 100}%` }}
          />
        </div>
        {t3Unlocked && <p className="mt-1 text-xs text-tier-t2">✓ T3 Unlocked!</p>}
        {!t2Unlocked && <p className="mt-1 text-xs text-text-muted">Complete T1 first</p>}
      </div>

      {/* Reputation */}
      <div className="pt-2 border-t border-border-primary">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-text-secondary font-medium">Reputation</span>
          <span className={`text-xs font-bold ${
            progress.reputation >= 80 ? 'text-emerald' :
            progress.reputation >= 50 ? 'text-tier-t2' :
            'text-text-muted'
          }`}>
            {progress.reputation}/100
          </span>
        </div>
        <div className="h-1.5 bg-surface-hover rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              progress.reputation >= 80 ? 'bg-emerald' :
              progress.reputation >= 50 ? 'bg-tier-t2' :
              'bg-text-muted'
            }`}
            style={{ width: `${progress.reputation}%` }}
          />
        </div>
        {progress.reputation >= 80 && (
          <p className="mt-1 text-xs text-emerald">Veteran status: -0.5 threshold reduction</p>
        )}
      </div>
    </div>
  );
}

// Gamified Leaderboard Row (extends existing leaderboard)
export interface GamifiedLeaderboardEntry {
  rank: number;
  username: string;
  avatar_url: string | null;
  score: number;
  badges: BadgeType[];
  streak: number;
  tier: 1 | 2 | 3;
}

export function GamifiedLeaderboardRow({ entry }: { entry: GamifiedLeaderboardEntry }) {
  const rankStyle = {
    1: 'bg-gradient-to-r from-yellow-500/20 to-yellow-400/5 border-yellow-500/30',
    2: 'bg-gradient-to-r from-gray-400/20 to-gray-300/5 border-gray-400/30',
    3: 'bg-gradient-to-r from-amber-800/20 to-amber-600/5 border-amber-700/30',
  }[entry.rank] || 'bg-surface-card border-border-primary';

  const tierBadge = { 1: 'T1', 2: 'T2', 3: 'T3' }[entry.tier];
  const tierColor = { 1: 'bg-emerald/10 text-emerald border-emerald/20', 2: 'bg-tier-t2/10 text-tier-t2 border-tier-t2/20', 3: 'bg-tier-t3/10 text-tier-t3 border-tier-t3/20' }[entry.tier];

  // Show top 3 badges
  const topBadges = BADGE_DEFINITIONS.filter((b) => entry.badges.includes(b.type)).slice(0, 3);

  return (
    <div className={`flex items-center gap-4 px-4 py-3 rounded-lg border ${rankStyle}`}>
      {/* Rank */}
      <span className="text-lg font-bold text-text-primary w-8 text-center tabular-nums">
        {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : `#${entry.rank}`}
      </span>

      {/* Avatar */}
      {entry.avatar_url ? (
        <img src={entry.avatar_url} alt={entry.username} className="w-10 h-10 rounded-full" />
      ) : (
        <div className="w-10 h-10 rounded-full bg-surface-hover flex items-center justify-center text-sm font-mono text-text-muted">
          {entry.username.slice(0, 2).toUpperCase()}
        </div>
      )}

      {/* Name + Badges */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-text-primary truncate">{entry.username}</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${tierColor}`}>{tierBadge}</span>
        </div>
        <div className="flex items-center gap-1 mt-1">
          {topBadges.map((badge) => {
            const Icon = badge.icon;
            return <Icon key={badge.type} className="w-3.5 h-3.5 text-anvil-orange" />;
          })}
          {entry.streak >= 3 && (
            <span className="flex items-center gap-0.5 text-xs text-tier-t2">
              <Flame className="w-3 h-3" />{entry.streak}d
            </span>
          )}
        </div>
      </div>

      {/* Score */}
      <span className="text-lg font-bold text-emerald tabular-nums">{entry.score.toLocaleString()}</span>
    </div>
  );
}

export default LeaderboardGamification;
