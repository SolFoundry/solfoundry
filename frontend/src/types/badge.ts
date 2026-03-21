/**
 * Badge domain types for Contributor Badges & Achievements system.
 * @module types/badge
 */

/** Unique identifier for each badge type */
export type BadgeId =
  | 'first_blood'
  | 'on_fire'
  | 'rising_star'
  | 'diamond_hands'
  | 'top_contributor'
  | 'sharpshooter'
  | 'night_owl';

/** Represents a badge definition (static configuration) */
export interface BadgeDefinition {
  /** Unique badge identifier */
  id: BadgeId;
  /** Display name of the badge */
  name: string;
  /** Emoji icon for the badge */
  icon: string;
  /** Short description of how to earn the badge */
  description: string;
  /** Category for grouping badges */
  category: 'milestone' | 'quality' | 'special';
  /** Optional: milestone requirement (e.g., number of PRs) */
  requirement?: number;
}

/** Represents a user's earned badge status */
export interface BadgeStatus {
  /** Badge definition */
  badge: BadgeDefinition;
  /** Whether the badge has been earned */
  earned: boolean;
  /** When the badge was earned (ISO timestamp) */
  earnedAt?: string;
  /** Progress towards earning (0-100) */
  progress?: number;
}

/** Contributor stats used to compute badges */
export interface ContributorStats {
  /** Total number of merged PRs */
  mergedPRCount: number;
  /** Number of PRs merged with no revision requests */
  cleanMergeCount: number;
  /** PRs submitted in the current month */
  prsThisMonth: number;
  /** Most PRs merged by any contributor in the current month */
  topMonthlyPRCount: number;
  /** PRs submitted between midnight and 5am UTC */
  nightOwlPRs: number;
  /** List of PR timestamps (ISO strings) */
  prTimestamps: string[];
}

/** Props for the Badge component */
export interface BadgeProps {
  /** Badge definition to display */
  badge: BadgeDefinition;
  /** Whether the badge is earned */
  earned: boolean;
  /** When the badge was earned (for tooltip) */
  earnedAt?: string;
  /** Progress percentage for unearned badges */
  progress?: number;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

/** Props for the BadgeGrid component */
export interface BadgeGridProps {
  /** List of badge statuses to display */
  badges: BadgeStatus[];
  /** Number of columns in the grid */
  columns?: 2 | 3 | 4;
  /** Show only earned badges */
  earnedOnly?: boolean;
}

/** Props for the BadgeCount component (for profile cards) */
export interface BadgeCountProps {
  /** Total number of earned badges */
  count: number;
  /** Total number of available badges */
  total: number;
}