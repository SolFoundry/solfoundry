/**
 * Badge configuration - config-driven design for easy extension
 */

import { BadgeDefinition } from '../types/badge';

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'first_blood',
    name: 'First Blood',
    description: 'First PR merged',
    icon: '🥇',
  },
  {
    id: 'on_fire',
    name: 'On Fire',
    description: '3 PRs merged',
    icon: '🔥',
  },
  {
    id: 'rising_star',
    name: 'Rising Star',
    description: '5 PRs merged',
    icon: '⭐',
  },
  {
    id: 'diamond_hands',
    name: 'Diamond Hands',
    description: '10 PRs merged',
    icon: '💎',
  },
  {
    id: 'top_contributor',
    name: 'Top Contributor',
    description: 'Most PRs in a month',
    icon: '🏆',
  },
  {
    id: 'sharpshooter',
    name: 'Sharpshooter',
    description: '3 PRs merged with no revision requests',
    icon: '🎯',
  },
  {
    id: 'night_owl',
    name: 'Night Owl',
    description: 'PR submitted between midnight and 5am UTC',
    icon: '🌙',
  },
];