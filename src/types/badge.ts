export enum BadgeType {
  DEVELOPER = 'developer',
  CONTRIBUTOR = 'contributor',
  REVIEWER = 'reviewer',
  MENTOR = 'mentor',
  BOUNTY_HUNTER = 'bounty_hunter',
  TOP_CONTRIBUTOR = 'top_contributor',
  EARLY_ADOPTER = 'early_adopter',
  MILESTONE = 'milestone',
  ACHIEVEMENT = 'achievement',
  SPECIAL = 'special'
}

export enum BadgeRarity {
  COMMON = 'common',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary'
}

export interface BadgeData {
  id: string;
  name: string;
  description: string;
  type: BadgeType;
  rarity: BadgeRarity;
  iconUrl: string;
  color: string;
  issuedAt: string;
  expiresAt?: string;
  issuer: string;
  metadata?: Record<string, any>;
}

export interface BadgeConfig {
  type: BadgeType;
  name: string;
  description: string;
  rarity: BadgeRarity;
  iconUrl: string;
  color: string;
  criteria: {
    minContributions?: number;
    minBountiesCompleted?: number;
    minReviewsCompleted?: number;
    requiredSkills?: string[];
    timeframe?: string;
    customCriteria?: Record<string, any>;
  };
  rewards?: {
    points: number;
    multiplier: number;
    specialPerks?: string[];
  };
  isActive: boolean;
  maxIssuances?: number;
  validityPeriod?: string;
}

export interface UserBadge {
  id: string;
  userId: string;
  badgeId: string;
  badge: BadgeData;
  earnedAt: string;
  progress?: number;
  isVisible: boolean;
  verificationHash?: string;
}

export interface BadgeProgress {
  badgeId: string;
  userId: string;
  currentProgress: number;
  totalRequired: number;
  progressData: Record<string, any>;
  lastUpdated: string;
}

export interface BadgeCategory {
  id: string;
  name: string;
  description: string;
  badges: string[];
  displayOrder: number;
  isVisible: boolean;
}

export interface BadgeValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  verificationStatus: 'pending' | 'verified' | 'failed';
}

export interface BadgeStats {
  totalBadges: number;
  badgesByType: Record<BadgeType, number>;
  badgesByRarity: Record<BadgeRarity, number>;
  recentlyEarned: UserBadge[];
  popularBadges: Array<{
    badgeId: string;
    count: number;
    badge: BadgeData;
  }>;
}

export interface BadgeFilters {
  types?: BadgeType[];
  rarities?: BadgeRarity[];
  isActive?: boolean;
  hasRewards?: boolean;
  searchQuery?: string;
  categories?: string[];
}

export interface BadgeSearchResult {
  badges: BadgeData[];
  totalCount: number;
  hasMore: boolean;
  nextCursor?: string;
}

export type BadgeEventType =
  | 'badge_earned'
  | 'badge_revoked'
  | 'badge_updated'
  | 'progress_updated'
  | 'milestone_reached';

export interface BadgeEvent {
  id: string;
  type: BadgeEventType;
  userId: string;
  badgeId: string;
  timestamp: string;
  data: Record<string, any>;
  processedAt?: string;
}

export interface BadgeNotification {
  id: string;
  userId: string;
  type: 'earned' | 'progress' | 'milestone' | 'expired';
  title: string;
  message: string;
  badgeId?: string;
  isRead: boolean;
  createdAt: string;
}

export type BadgeCreateInput = Omit<BadgeData, 'id' | 'issuedAt'>;
export type BadgeUpdateInput = Partial<BadgeCreateInput>;
export type UserBadgeCreateInput = Omit<UserBadge, 'id' | 'earnedAt'>;
