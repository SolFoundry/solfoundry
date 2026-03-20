import type { DashboardData, Notification, Activity, ActiveBounty, DailyEarning } from '../types/dashboard';

const daysAgo = (days: number): string => { const date = new Date(); date.setDate(date.getDate() - days); return date.toISOString(); };
const hoursAgo = (hours: number): string => { const date = new Date(); date.setHours(date.getHours() - hours); return date.toISOString(); };

export const mockDailyEarnings: DailyEarning[] = Array.from({ length: 30 }, (_, i) => {
  const date = new Date(); date.setDate(date.getDate() - (29 - i));
  return { date: date.toISOString().split('T')[0], amount: Math.random() > 0.7 ? Math.floor(Math.random() * 500) + 100 : 0 };
});

export const mockActiveBounties: ActiveBounty[] = [
  { id: 'bounty-1', title: 'GitHub <-> Platform Bi-directional Sync', tier: 'T2', reward: 450000, deadline: daysAgo(-5), claimedAt: daysAgo(2), progress: 'in-progress', progressPercent: 65 },
  { id: 'bounty-2', title: 'Real-time WebSocket Server', tier: 'T2', reward: 400000, deadline: daysAgo(-3), claimedAt: daysAgo(4), progress: 'review', progressPercent: 85 },
  { id: 'bounty-3', title: 'Add CI/CD pipeline with GitHub Actions', tier: 'T1', reward: 100, deadline: daysAgo(-1), claimedAt: daysAgo(1), progress: 'final', progressPercent: 95 },
];

export const mockActivities: Activity[] = [
  { id: 'act-1', type: 'payout', title: 'Payout Received', description: 'Received 50,000 \ for PR #134', timestamp: hoursAgo(2), metadata: { amount: 50000, prNumber: 134 } },
  { id: 'act-2', type: 'review_received', title: 'PR Review Completed', description: 'Your PR #134 passed AI review with score 8.5/10', timestamp: hoursAgo(5), metadata: { prNumber: 134, score: 8.5 } },
  { id: 'act-3', type: 'bounty_claimed', title: 'Bounty Claimed', description: 'You claimed "GitHub <-> Platform Bi-directional Sync"', timestamp: hoursAgo(48), metadata: { bountyId: 'bounty-1', bountyTitle: 'GitHub <-> Platform Bi-directional Sync' } },
  { id: 'act-4', type: 'pr_submitted', title: 'PR Submitted', description: 'Submitted PR #134 for "PR Status Tracker Component"', timestamp: hoursAgo(50), metadata: { prNumber: 134 } },
  { id: 'act-5', type: 'bounty_completed', title: 'Bounty Completed', description: 'Completed "Site Navigation & Layout Shell"', timestamp: daysAgo(3), metadata: { bountyId: 'bounty-107', amount: 75000 } },
  { id: 'act-6', type: 'tier_unlocked', title: 'Tier 2 Unlocked', description: 'You can now access Tier 2 bounties!', timestamp: daysAgo(5), metadata: { tier: 'T2' } },
  { id: 'act-7', type: 'reputation_change', title: 'Reputation Increased', description: 'Your reputation score increased by 15 points', timestamp: daysAgo(7), metadata: { score: 15 } },
];

export const mockNotifications: Notification[] = [
  { id: 'notif-1', type: 'warning', priority: 'high', title: 'Deadline Approaching', message: 'Bounty "Real-time WebSocket Server" deadline is in 3 days', timestamp: hoursAgo(1), read: false, actionUrl: '/bounties/bounty-2', actionLabel: 'View Bounty' },
  { id: 'notif-2', type: 'success', priority: 'medium', title: 'Payout Complete', message: '50,000 \ has been sent to your wallet', timestamp: hoursAgo(2), read: false },
  { id: 'notif-3', type: 'info', priority: 'medium', title: 'New Bounty Available', message: 'A new Tier 2 bounty matching your skills is available', timestamp: hoursAgo(6), read: true, actionUrl: '/bounties', actionLabel: 'Browse Bounties' },
  { id: 'notif-4', type: 'error', priority: 'high', title: 'PR Needs Revision', message: 'PR #120 requires changes based on AI review feedback', timestamp: daysAgo(1), read: true, actionUrl: '/pr/120', actionLabel: 'View PR' },
  { id: 'notif-5', type: 'info', priority: 'low', title: 'Weekly Summary', message: 'Your weekly contributor report is ready', timestamp: daysAgo(2), read: true, actionUrl: '/reports/weekly', actionLabel: 'View Report' },
];

export const mockDashboardData: DashboardData = {
  summary: { totalEarned: 1250000, activeBounties: 3, pendingPayouts: 50000, reputationScore: 87, reputationRank: 12, totalContributors: 156, bountiesCompleted: 10, successRate: 91 },
  activeBounties: mockActiveBounties,
  earnings: { totalEarned: 1250000, pendingPayouts: 50000, last30Days: mockDailyEarnings, currency: '\' },
  recentActivity: mockActivities,
  notifications: mockNotifications,
  settings: {
    linkedAccounts: [
      { platform: 'github', username: 'HuiNeng6', connected: true, connectedAt: daysAgo(30) },
      { platform: 'twitter', username: '', connected: false },
      { platform: 'discord', username: 'huineng#1234', connected: true, connectedAt: daysAgo(15) },
      { platform: 'telegram', username: '', connected: false },
    ],
    notificationPreferences: { email: true, push: true, bountyUpdates: true, payoutAlerts: true, reviewNotifications: true },
    wallet: { address: 'Amu1YJjcKWKL6xuMTo2dx511kfzXAxgpetJrZp7N71o7', type: 'solana', connected: true, connectedAt: daysAgo(30) },
  },
};
