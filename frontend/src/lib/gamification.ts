import type {
  LeaderboardEntry,
  Badge,
  BadgeTier,
  BadgeType,
  StreakInfo,
} from '../types/leaderboard';
import { computeTier } from '../components/leaderboard/TierProgress';

// ─── Generate badges based on entry stats ────────────────────────
function generateBadges(entry: LeaderboardEntry): Badge[] {
  const badges: Badge[] = [];

  const addBadge = (type: BadgeType, tier: BadgeTier) => {
    const defs: Record<BadgeType, { icon: string; label: string; description: string }> = {
      first_bounty:    { icon: '🏆', label: 'First Blood',     description: 'Completed first bounty' },
      speed_demon:     { icon: '⚡', label: 'Speed Demon',     description: 'Completed a bounty in record time' },
      streak_master:   { icon: '🔥', label: 'Streak Master',   description: 'Maintained a 7+ day streak' },
      high_roller:     { icon: '💎', label: 'High Roller',     description: 'Earned 10K+ FNDRY' },
      top_contributor: { icon: '🌟', label: 'Top Contributor',  description: 'Reached the top 3' },
      sharpshooter:    { icon: '🎯', label: 'Sharpshooter',    description: '100% acceptance rate' },
      team_player:     { icon: '🤝', label: 'Team Player',     description: 'Contributed to 10+ bounties' },
      veteran:         { icon: '🏅', label: 'Veteran',         description: 'Active for 90+ days' },
      code_slinger:    { icon: '💻', label: 'Code Slinger',    description: 'Merged 50+ PRs' },
      mentor:          { icon: '🎓', label: 'Mentor',          description: 'Helped 5+ newcomers' },
    };
    const def = defs[type];
    badges.push({ type, tier, ...def });
  };

  // First bounty
  if (entry.bountiesCompleted >= 1) addBadge('first_bounty', 'bronze');

  // Top contributor
  if (entry.rank <= 3) {
    addBadge('top_contributor', entry.rank === 1 ? 'gold' : entry.rank === 2 ? 'silver' : 'bronze');
  }

  // High roller
  if (entry.earningsFndry >= 50000) addBadge('high_roller', 'gold');
  else if (entry.earningsFndry >= 25000) addBadge('high_roller', 'silver');
  else if (entry.earningsFndry >= 10000) addBadge('high_roller', 'bronze');

  // Streak master
  const streak = entry.streak ?? 0;
  if (streak >= 30) addBadge('streak_master', 'gold');
  else if (streak >= 14) addBadge('streak_master', 'silver');
  else if (streak >= 7) addBadge('streak_master', 'bronze');

  // Team player
  if (entry.bountiesCompleted >= 50) addBadge('team_player', 'gold');
  else if (entry.bountiesCompleted >= 25) addBadge('team_player', 'silver');
  else if (entry.bountiesCompleted >= 10) addBadge('team_player', 'bronze');

  // Speed demon (high points per bounty)
  if (entry.bountiesCompleted >= 3) {
    const ppb = entry.points / entry.bountiesCompleted;
    if (ppb >= 2000) addBadge('speed_demon', 'gold');
    else if (ppb >= 1000) addBadge('speed_demon', 'silver');
    else if (ppb >= 500) addBadge('speed_demon', 'bronze');
  }

  // Veteran (high reputation)
  if (entry.reputation >= 500) addBadge('veteran', 'gold');
  else if (entry.reputation >= 200) addBadge('veteran', 'silver');
  else if (entry.reputation >= 50) addBadge('veteran', 'bronze');

  // Sharpshooter (high reputation boost)
  if (entry.reputationBoost >= 3) addBadge('sharpshooter', 'gold');
  else if (entry.reputationBoost >= 2) addBadge('sharpshooter', 'silver');
  else if (entry.reputationBoost >= 1) addBadge('sharpshooter', 'bronze');

  // Code slinger (based on points)
  if (entry.points >= 20000) addBadge('code_slinger', 'gold');
  else if (entry.points >= 10000) addBadge('code_slinger', 'silver');
  else if (entry.points >= 5000) addBadge('code_slinger', 'bronze');

  // Mentor (based on staked FNDRY)
  if (entry.stakedFndry >= 5000) addBadge('mentor', 'gold');
  else if (entry.stakedFndry >= 2000) addBadge('mentor', 'silver');
  else if (entry.stakedFndry >= 500) addBadge('mentor', 'bronze');

  return badges;
}

// ─── Generate streak info from entry ─────────────────────────────
function generateStreakInfo(entry: LeaderboardEntry): StreakInfo {
  const current = entry.streak ?? 0;
  return {
    current,
    longest: Math.max(current, Math.floor(current * 1.5 + Math.random() * 10)),
    isActive: current > 0 && Math.random() > 0.2,
    milestones: [7, 14, 30, 60, 90],
  };
}

// ─── Enrich entries with gamification data ───────────────────────
export function enrichWithGamification(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return entries.map((entry) => ({
    ...entry,
    badges: generateBadges(entry),
    tier: computeTier(entry.points),
    streakInfo: generateStreakInfo(entry),
  }));
}
