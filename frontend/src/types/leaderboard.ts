// ─── Badge Types ─────────────────────────────────────────────────
export type BadgeTier = 'gold' | 'silver' | 'bronze';

export type BadgeType =
  | 'first_bounty'
  | 'speed_demon'
  | 'streak_master'
  | 'high_roller'
  | 'top_contributor'
  | 'sharpshooter'
  | 'team_player'
  | 'veteran'
  | 'code_slinger'
  | 'mentor';

export interface Badge {
  type: BadgeType;
  tier: BadgeTier;
  icon: string;
  label: string;
  description: string;
}

// ─── Streak Types ────────────────────────────────────────────────
export interface StreakInfo {
  current: number;
  longest: number;
  isActive: boolean;
  milestones: number[];
}

// ─── Tier Types ──────────────────────────────────────────────────
export type TierName = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';

export interface ContributorTier {
  name: TierName;
  level: number;
  currentXP: number;
  nextTierXP: number;
  color: string;
  glowColor: string;
}

// ─── Leaderboard Entry ───────────────────────────────────────────
export interface LeaderboardEntry {
  rank: number;
  username: string;
  avatarUrl?: string | null;
  points: number;
  bountiesCompleted: number;
  earningsFndry: number;
  earningsSol: number;
  streak?: number | null;
  topSkills: string[];
  reputation: number;
  stakedFndry: number;
  reputationBoost: number;
  // Gamification-enriched fields (added client-side)
  badges?: Badge[];
  tier?: ContributorTier;
  streakInfo?: StreakInfo;
}

export interface PlatformStats {
  open_bounties: number;
  total_paid_usdc: number;
  total_contributors: number;
  total_bounties: number;
}

export type TimePeriod = '7d' | '30d' | '90d' | 'all';
