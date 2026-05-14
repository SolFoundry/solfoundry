/**
 * Notification filter system — per-user preferences for which bounties to be notified about.
 */

export interface UserFilter {
  /** Discord user ID. */
  userId: string;
  /** Minimum reward amount to trigger notification (0 = any). */
  minReward: number;
  /** Only notify for these skill tags (empty = any). */
  skills: string[];
  /** Only notify for these tiers (empty = any). */
  tiers: string[];
  /** Notification enabled. */
  enabled: boolean;
}

/** In-memory store (resets on bot restart — persist to DB later). */
const filters = new Map<string, UserFilter>();

function getKey(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}

export function getFilter(guildId: string, userId: string): UserFilter {
  const key = getKey(guildId, userId);
  return filters.get(key) ?? {
    userId,
    minReward: 0,
    skills: [],
    tiers: [],
    enabled: true,
  };
}

export function setFilter(guildId: string, userId: string, update: Partial<UserFilter>): UserFilter {
  const key = getKey(guildId, userId);
  const current = getFilter(guildId, userId);
  const next = { ...current, ...update };
  filters.set(key, next);
  return next;
}

/** Check if a bounty matches a user's filter. */
export function matchesFilter(bounty: { reward_amount: number; tier: string; skills: string[] }, filter: UserFilter): boolean {
  if (!filter.enabled) return false;
  if (bounty.reward_amount < filter.minReward) return false;
  if (filter.tiers.length > 0 && !filter.tiers.includes(bounty.tier)) return false;
  if (filter.skills.length > 0 && !bounty.skills.some(s => filter.skills.includes(s))) return false;
  return true;
}
