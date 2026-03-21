/**
 * Badge configuration - All available badges defined here.
 * Easy to add new badges in the future (config-driven).
 * @module config/badges
 */

import type { BadgeDefinition } from '../types/badge';

/** All available badge definitions */
export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'first_blood',
    name: 'First Blood',
    icon: '🥇',
    description: 'First PR merged',
    category: 'milestone',
    requirement: 1,
  },
  {
    id: 'on_fire',
    name: 'On Fire',
    icon: '🔥',
    description: '3 PRs merged',
    category: 'milestone',
    requirement: 3,
  },
  {
    id: 'rising_star',
    name: 'Rising Star',
    icon: '⭐',
    description: '5 PRs merged',
    category: 'milestone',
    requirement: 5,
  },
  {
    id: 'diamond_hands',
    name: 'Diamond Hands',
    icon: '💎',
    description: '10 PRs merged',
    category: 'milestone',
    requirement: 10,
  },
  {
    id: 'top_contributor',
    name: 'Top Contributor',
    icon: '🏆',
    description: 'Most PRs in a month',
    category: 'special',
  },
  {
    id: 'sharpshooter',
    name: 'Sharpshooter',
    icon: '🎯',
    description: '3 PRs merged with no revision requests',
    category: 'quality',
    requirement: 3,
  },
  {
    id: 'night_owl',
    name: 'Night Owl',
    icon: '🌙',
    description: 'PR submitted between midnight and 5am UTC',
    category: 'special',
    requirement: 1,
  },
];

/** Get badge definition by ID */
export function getBadgeById(id: string): BadgeDefinition | undefined {
  return BADGE_DEFINITIONS.find(badge => badge.id === id);
}

/** Total number of available badges */
export const TOTAL_BADGES = BADGE_DEFINITIONS.length;

/** Badge IDs grouped by category */
export const BADGES_BY_CATEGORY = {
  milestone: BADGE_DEFINITIONS.filter(b => b.category === 'milestone'),
  quality: BADGE_DEFINITIONS.filter(b => b.category === 'quality'),
  special: BADGE_DEFINITIONS.filter(b => b.category === 'special'),
};