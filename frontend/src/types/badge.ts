/**
 * Badge system types for contributor achievements
 */

export type BadgeId =
  | 'first_blood'
  | 'on_fire'
  | 'rising_star'
  | 'diamond_hands'
  | 'top_contributor'
  | 'sharpshooter'
  | 'night_owl';

export interface BadgeDefinition {
  id: BadgeId;
  name: string;
  description: string;
  icon: string;
}

export interface BadgeState {
  id: BadgeId;
  earned: boolean;
  progress?: number;
  maxProgress?: number;
}

export interface ContributorStats {
  prsMerged: number;
  prsWithNoRevisions: number;
  monthlyPRs: number;
  isMonthlyTop: boolean;
  prTimestamps: number[];
}