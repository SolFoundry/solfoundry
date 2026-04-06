export type BadgeType =
  | 'first-blood'
  | 'speed-demon'
  | 'consistent'
  | 'on-fire'
  | 'top-hunter'
  | 'all-rounder'
  | 'big-earner'
  | 'whale'
  | 'OG'
  | 'reviewer'
  | 'streak-3'
  | 'streak-7'
  | 'streak-30';

export type ContributorTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface Badge {
  type: BadgeType;
  label: string;
  description: string;
  tier: ContributorTier;
  icon: string;
}

export const BADGE_DEFINITIONS: Record<BadgeType, Badge> = {
  'first-blood': { type: 'first-blood', label: 'First Blood', description: 'Completed your first bounty', tier: 'bronze', icon: '⚔️' },
  'speed-demon': { type: 'speed-demon', label: 'Speed Demon', description: 'Completed a bounty in under 24 hours', tier: 'silver', icon: '⚡' },
  'consistent': { type: 'consistent', label: 'Consistent', description: '3+ bounties in a row without missing', tier: 'silver', icon: '🎯' },
  'on-fire': { type: 'on-fire', label: 'On Fire', description: '7+ day contribution streak', tier: 'gold', icon: '🔥' },
  'top-hunter': { type: 'top-hunter', label: 'Top Hunter', description: 'Ranked in top 10 of any leaderboard period', tier: 'gold', icon: '🏆' },
  'all-rounder': { type: 'all-rounder', label: 'All-Rounder', description: 'Completed bounties in 5+ different skill areas', tier: 'silver', icon: '🧩' },
  'big-earner': { type: 'big-earner', label: 'Big Earner', description: 'Earned $1,000+ in total bounties', tier: 'gold', icon: '💰' },
  'whale': { type: 'whale', label: 'Whale', description: 'Earned $10,000+ in total bounties', tier: 'platinum', icon: '🐋' },
  'OG': { type: 'OG', label: 'OG', description: 'Early SolFoundry contributor', tier: 'platinum', icon: '👑' },
  'reviewer': { type: 'reviewer', label: 'Reviewer', description: 'Passed 5+ AI code reviews', tier: 'silver', icon: '🤖' },
  'streak-3': { type: 'streak-3', label: '3-Day Streak', description: 'Contributed 3 days in a row', tier: 'bronze', icon: '📅' },
  'streak-7': { type: 'streak-7', label: '7-Day Streak', description: 'Contributed 7 days in a row', tier: 'silver', icon: '🔥' },
  'streak-30': { type: 'streak-30', label: '30-Day Streak', description: 'Contributed 30 days in a row', tier: 'gold', icon: '🚀' },
};

export const TIER_THRESHOLDS: Record<ContributorTier, number> = {
  bronze: 0, silver: 1000, gold: 5000, platinum: 20000,
};

export const TIER_ORDER: ContributorTier[] = ['bronze', 'silver', 'gold', 'platinum'];

export function computeTier(points: number): ContributorTier {
  if (points >= TIER_THRESHOLDS.platinum) return 'platinum';
  if (points >= TIER_THRESHOLDS.gold) return 'gold';
  if (points >= TIER_THRESHOLDS.silver) return 'silver';
  return 'bronze';
}

export function computeTierProgress(points: number): { tier: ContributorTier; progress: number; nextTierPoints: number } {
  const tier = computeTier(points);
  const tierIndex = TIER_ORDER.indexOf(tier);
  const currentThreshold = TIER_THRESHOLDS[tier];
  const nextTier = tierIndex < TIER_ORDER.length - 1 ? TIER_ORDER[tierIndex + 1] : undefined;
  const nextThreshold = nextTier ? TIER_THRESHOLDS[nextTier] : currentThreshold + 1;
  const progress = nextTier
    ? Math.min(100, Math.round(((points - currentThreshold) / (nextThreshold - currentThreshold)) * 100))
    : 100;
  return { tier, progress, nextTierPoints: nextThreshold };
}

export function deriveBadges(entry: {
  rank: number; streak?: number | null; earningsFndry: number;
  topSkills: string[]; bountiesCompleted: number; points: number; reputation: number;
}): BadgeType[] {
  const badges: BadgeType[] = [];
  if (entry.bountiesCompleted >= 1) badges.push('first-blood');
  if (entry.streak && entry.streak >= 30) badges.push('streak-30', 'on-fire');
  else if (entry.streak && entry.streak >= 7) badges.push('streak-7', 'on-fire');
  else if (entry.streak && entry.streak >= 3) badges.push('streak-3', 'consistent');
  if (entry.rank <= 10) badges.push('top-hunter');
  if (entry.topSkills.length >= 5) badges.push('all-rounder');
  if (entry.earningsFndry >= 10000) badges.push('whale', 'big-earner');
  else if (entry.earningsFndry >= 1000) badges.push('big-earner');
  if (entry.points >= 5000) badges.push('OG');
  if (entry.reputation >= 500) badges.push('reviewer');
  return [...new Set(badges)];
}

export function getTierColor(tier: ContributorTier): string {
  switch (tier) {
    case 'platinum': return 'text-purple-400';
    case 'gold': return 'text-yellow-400';
    case 'silver': return 'text-zinc-400';
    case 'bronze': return 'text-orange-400';
  }
}

export function getTierBgColor(tier: ContributorTier): string {
  switch (tier) {
    case 'platinum': return 'bg-purple-400/20 border-purple-400/40';
    case 'gold': return 'bg-yellow-400/20 border-yellow-400/40';
    case 'silver': return 'bg-zinc-400/20 border-zinc-400/40';
    case 'bronze': return 'bg-orange-400/20 border-orange-400/40';
  }
}

export function getTierLabel(tier: ContributorTier): string {
  switch (tier) {
    case 'platinum': return 'Platinum';
    case 'gold': return 'Gold';
    case 'silver': return 'Silver';
    case 'bronze': return 'Bronze';
  }
}