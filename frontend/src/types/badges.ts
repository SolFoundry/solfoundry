export type BadgeId =
  | 'first-blood'
  | 'on-fire'
  | 'rising-star'
  | 'diamond-hands'
  | 'top-contributor'
  | 'sharpshooter'
  | 'night-owl';

export interface ContributorBadgeStats {
  mergedPrCount: number;
  mergedWithoutRevisionCount: number;
  isTopContributorThisMonth: boolean;
  prSubmissionTimestampsUtc: string[];
}

export interface BadgeDefinition {
  id: BadgeId;
  name: string;
  description: string;
  icon: string;
  isEarned: (stats: ContributorBadgeStats) => boolean;
}

export interface BadgeWithStatus extends BadgeDefinition {
  earned: boolean;
}

const NIGHT_OWL_START_HOUR_UTC = 0;
const NIGHT_OWL_END_HOUR_UTC = 5;

function wasSubmittedAtNightInUtc(timestamp: string): boolean {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  const utcHour = date.getUTCHours();
  return utcHour >= NIGHT_OWL_START_HOUR_UTC && utcHour < NIGHT_OWL_END_HOUR_UTC;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'first-blood',
    name: 'First Blood',
    description: 'First PR merged',
    icon: '🥇',
    isEarned: (stats) => stats.mergedPrCount >= 1,
  },
  {
    id: 'on-fire',
    name: 'On Fire',
    description: '3 PRs merged',
    icon: '🔥',
    isEarned: (stats) => stats.mergedPrCount >= 3,
  },
  {
    id: 'rising-star',
    name: 'Rising Star',
    description: '5 PRs merged',
    icon: '⭐',
    isEarned: (stats) => stats.mergedPrCount >= 5,
  },
  {
    id: 'diamond-hands',
    name: 'Diamond Hands',
    description: '10 PRs merged',
    icon: '💎',
    isEarned: (stats) => stats.mergedPrCount >= 10,
  },
  {
    id: 'top-contributor',
    name: 'Top Contributor',
    description: 'Most PRs in a month',
    icon: '🏆',
    isEarned: (stats) => stats.isTopContributorThisMonth,
  },
  {
    id: 'sharpshooter',
    name: 'Sharpshooter',
    description: '3 PRs merged with no revision requests',
    icon: '🎯',
    isEarned: (stats) => stats.mergedWithoutRevisionCount >= 3,
  },
  {
    id: 'night-owl',
    name: 'Night Owl',
    description: 'PR submitted between midnight and 5am UTC',
    icon: '🌙',
    isEarned: (stats) => stats.prSubmissionTimestampsUtc.some(wasSubmittedAtNightInUtc),
  },
];

export function computeBadges(stats: ContributorBadgeStats): BadgeWithStatus[] {
  return BADGE_DEFINITIONS.map((badge) => ({
    ...badge,
    earned: badge.isEarned(stats),
  }));
}
