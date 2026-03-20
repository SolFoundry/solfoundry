/**
 * Dashboard Types for Contributor Dashboard
 */
export type ActivityType = 'bounty_claimed' | 'pr_submitted' | 'review_received' | 'payout' | 'bounty_completed' | 'bounty_cancelled' | 'tier_unlocked' | 'reputation_change';

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description?: string;
  timestamp: string;
  metadata?: { bountyId?: string; bountyTitle?: string; prNumber?: number; amount?: number; score?: number; tier?: 'T1' | 'T2' | 'T3' };
}

export type BountyProgress = 'not-started' | 'in-progress' | 'review' | 'final';

export interface ActiveBounty {
  id: string;
  title: string;
  tier: 'T1' | 'T2' | 'T3';
  reward: number;
  deadline: string;
  claimedAt: string;
  progress: BountyProgress;
  progressPercent: number;
}

export interface DailyEarning { date: string; amount: number; }

export interface EarningsSummary {
  totalEarned: number;
  pendingPayouts: number;
  last30Days: DailyEarning[];
  currency: string;
}

export type NotificationPriority = 'low' | 'medium' | 'high';

export interface Notification {
  id: string;
  type: 'info' | 'warning' | 'success' | 'error';
  priority: NotificationPriority;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
}

export interface LinkedAccount {
  platform: 'github' | 'twitter' | 'discord' | 'telegram';
  username: string;
  connected: boolean;
  connectedAt?: string;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  bountyUpdates: boolean;
  payoutAlerts: boolean;
  reviewNotifications: boolean;
}

export interface WalletInfo { address: string; type: 'solana'; connected: boolean; connectedAt?: string; }

export interface DashboardSummary {
  totalEarned: number;
  activeBounties: number;
  pendingPayouts: number;
  reputationScore: number;
  reputationRank: number;
  totalContributors: number;
  bountiesCompleted: number;
  successRate: number;
}

export interface DashboardData {
  summary: DashboardSummary;
  activeBounties: ActiveBounty[];
  earnings: EarningsSummary;
  recentActivity: Activity[];
  notifications: Notification[];
  settings: { linkedAccounts: LinkedAccount[]; notificationPreferences: NotificationPreferences; wallet: WalletInfo };
}

export type DashboardTab = 'overview' | 'bounties' | 'earnings' | 'activity' | 'notifications' | 'settings';

export const DASHBOARD_TABS: { id: DashboardTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'bounties', label: 'Active Bounties' },
  { id: 'earnings', label: 'Earnings' },
  { id: 'activity', label: 'Activity' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'settings', label: 'Settings' },
];
