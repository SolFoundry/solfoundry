/** Badge definitions and tier system for leaderboard gamification */

export type BadgeId =
  | 'first-blood'
  | 'speed-demon'
  | 'consistent'
  | 'on-fire'
  | 'top-hunter'
  | 'all-rounder'
  | 'big-earner'
  | 'whale'
  | 'og'
  | 'reviewer'
  | 'streak-7'
  | 'streak-14'
  | 'streak-30';

export interface BadgeDef {
  id: BadgeId;
  label: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold';
}

export type UserTier = 'bronze' | 'silver' | 'gold' | 'diamond' | 'master';

export interface UserTierDef {
  tier: UserTier;
  label: string;
  minPoints: number;
  color: string;
  icon: string;
}

export const TIERS: UserTierDef[] = [
  { tier: 'bronze', label: 'Bronze', minPoints: 0, color: '#CD7F32', icon: '🥉' },
  { tier: 'silver', label: 'Silver', minPoints: 100, color: '#C0C0C0', icon: '🥈' },
  { tier: 'gold', label: 'Gold', minPoints: 500, color: '#FFD700', icon: '🥇' },
  { tier: 'diamond', label: 'Diamond', minPoints: 2000, color: '#B9F2FF', icon: '💎' },
  { tier: 'master', label: 'Master', minPoints: 10000, color: '#FF6B35', icon: '👑' },
];

export const BADGES: BadgeDef[] = [
  { id: 'first-blood', label: 'First Blood', description: 'Completed first bounty', icon: '🩸', tier: 'bronze' },
  { id: 'speed-demon', label: 'Speed Demon', description: 'Completed a bounty within 24 hours', icon: '⚡', tier: 'silver' },
  { id: 'consistent', label: 'Consistent', description: 'Completed bounties for 7 consecutive weeks', icon: '📅', tier: 'silver' },
  { id: 'on-fire', label: 'On Fire', description: 'Completed 5 bounties in 7 days', icon: '🔥', tier: 'gold' },
  { id: 'top-hunter', label: 'Top Hunter', description: 'Ranked #1 for a period', icon: '🏆', tier: 'gold' },
  { id: 'all-rounder', label: 'All-Rounder', description: 'Completed bounties in 5+ languages', icon: '🔄', tier: 'silver' },
  { id: 'big-earner', label: 'Big Earner', description: 'Earned 10K+ FNDRY', icon: '💰', tier: 'silver' },
  { id: 'whale', label: 'Whale', description: 'Earned 100K+ FNDRY', icon: '🐋', tier: 'gold' },
  { id: 'og', label: 'OG', description: 'Joined in the first month', icon: '🏅', tier: 'gold' },
  { id: 'reviewer', label: 'Reviewer', description: 'Submitted 10+ quality reviews', icon: '📝', tier: 'bronze' },
  { id: 'streak-7', label: '7-Day Streak', description: 'Completed bounties 7 days in a row', icon: '📆', tier: 'bronze' },
  { id: 'streak-14', label: '14-Day Streak', description: 'Completed bounties 14 days in a row', icon: '📆', tier: 'silver' },
  { id: 'streak-30', label: '30-Day Streak', description: 'Completed bounties 30 days in a row', icon: '📆', tier: 'gold' },
];

export function getBadgeDef(id: BadgeId): BadgeDef | undefined {
  return BADGES.find((b) => b.id === id);
}

export function getUserTier(points: number): UserTierDef {
  let current = TIERS[0];
  for (const t of TIERS) {
    if (points >= t.minPoints) current = t;
  }
  return current;
}

export function getNextTier(points: number): UserTierDef | null {
  for (let i = 0; i < TIERS.length - 1; i++) {
    const next = TIERS[i + 1];
    if (points < next.minPoints) return next;
  }
  return null;
}

export function getTierProgress(points: number): { current: UserTierDef; next: UserTierDef | null; progress: number } {
  const current = getUserTier(points);
  const next = getNextTier(points);
  if (!next) return { current, next: null, progress: 1 };
  const range = next.minPoints - current.minPoints;
  const progress = range > 0 ? (points - current.minPoints) / range : 1;
  return { current, next, progress: Math.min(Math.max(progress, 0), 1) };
}

export function getStreakLevel(streak: number): { label: string; color: string; icon: string } {
  if (streak >= 30) return { label: 'Legendary', color: '#FF6B35', icon: '🔥' };
  if (streak >= 14) return { label: 'Blazing', color: '#FF4500', icon: '🔥' };
  if (streak >= 7) return { label: 'On Fire', color: '#FF8C00', icon: '🔥' };
  if (streak >= 3) return { label: 'Warm', color: '#FFD700', icon: '🔥' };
  return { label: 'Starting', color: '#C0C0C0', icon: '🔥' };
}