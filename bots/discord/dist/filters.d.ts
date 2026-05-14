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
export declare function getFilter(guildId: string, userId: string): UserFilter;
export declare function setFilter(guildId: string, userId: string, update: Partial<UserFilter>): UserFilter;
/** Check if a bounty matches a user's filter. */
export declare function matchesFilter(bounty: {
    reward_amount: number;
    tier: string;
    skills: string[];
}, filter: UserFilter): boolean;
