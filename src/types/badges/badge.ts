export enum BadgeType { FIRST_PR = 'first_pr', ACTIVE_CONTRIBUTOR = 'active_contributor', BUG_HUNTER = 'bug_hunter' }
export enum BadgeTier { BRONZE = 'bronze', SILVER = 'silver', GOLD = 'gold' }
export interface Badge { id: string; name: string; type: BadgeType; tier?: BadgeTier; isUnlocked: boolean; unlockedAt?: Date; }
export interface UserBadges { username: string; badges: Badge[]; stats: { total: number; unlocked: number; }; }
// Issue #263 Bounty Contribution - 150,000 FNDRY
