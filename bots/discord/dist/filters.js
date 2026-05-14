"use strict";
/**
 * Notification filter system — per-user preferences for which bounties to be notified about.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFilter = getFilter;
exports.setFilter = setFilter;
exports.matchesFilter = matchesFilter;
/** In-memory store (resets on bot restart — persist to DB later). */
const filters = new Map();
function getKey(guildId, userId) {
    return `${guildId}:${userId}`;
}
function getFilter(guildId, userId) {
    const key = getKey(guildId, userId);
    return filters.get(key) ?? {
        userId,
        minReward: 0,
        skills: [],
        tiers: [],
        enabled: true,
    };
}
function setFilter(guildId, userId, update) {
    const key = getKey(guildId, userId);
    const current = getFilter(guildId, userId);
    const next = { ...current, ...update };
    filters.set(key, next);
    return next;
}
/** Check if a bounty matches a user's filter. */
function matchesFilter(bounty, filter) {
    if (!filter.enabled)
        return false;
    if (bounty.reward_amount < filter.minReward)
        return false;
    if (filter.tiers.length > 0 && !filter.tiers.includes(bounty.tier))
        return false;
    if (filter.skills.length > 0 && !bounty.skills.some(s => filter.skills.includes(s)))
        return false;
    return true;
}
//# sourceMappingURL=filters.js.map