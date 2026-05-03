import type { Bounty } from '../types/bounty';
import type { LeaderboardEntry } from '../types/leaderboard';
import type { AnalyticsMetrics, AnalyticsPoint } from '../types/analytics';

function monthLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function addPoint(points: Map<string, AnalyticsPoint>, label: string, reward: number) {
  const current = points.get(label) ?? { label, bounties: 0, reward: 0 };
  current.bounties += 1;
  current.reward += reward;
  points.set(label, current);
}

export function buildAnalyticsMetrics(
  bounties: Bounty[],
  leaderboard: LeaderboardEntry[] = [],
): AnalyticsMetrics {
  const openBounties = bounties.filter((bounty) => bounty.status === 'open' || bounty.status === 'funded').length;
  const completedBounties = bounties.filter((bounty) => bounty.status === 'completed').length;
  const totalReward = bounties.reduce((sum, bounty) => sum + bounty.reward_amount, 0);
  const rewardByToken = bounties.reduce<Record<string, number>>((acc, bounty) => {
    acc[bounty.reward_token] = (acc[bounty.reward_token] ?? 0) + bounty.reward_amount;
    return acc;
  }, {});

  const volume = new Map<string, AnalyticsPoint>();
  const payouts = new Map<string, AnalyticsPoint>();
  for (const bounty of bounties) {
    addPoint(volume, monthLabel(bounty.created_at), bounty.reward_amount);
    addPoint(payouts, bounty.tier, bounty.reward_amount);
  }

  return {
    openBounties,
    completedBounties,
    totalReward,
    activeContributors: leaderboard.length,
    completionRate: bounties.length === 0 ? 0 : Math.round((completedBounties / bounties.length) * 100),
    rewardByToken,
    bountyVolume: Array.from(volume.values()),
    payoutDistribution: Array.from(payouts.values()).sort((a, b) => a.label.localeCompare(b.label)),
  };
}

export function analyticsCsv(metrics: AnalyticsMetrics): string {
  const rows = [
    ['metric', 'value'],
    ['open_bounties', String(metrics.openBounties)],
    ['completed_bounties', String(metrics.completedBounties)],
    ['total_reward', String(metrics.totalReward)],
    ['active_contributors', String(metrics.activeContributors)],
    ['completion_rate_percent', String(metrics.completionRate)],
  ];
  return rows.map((row) => row.join(',')).join('\n');
}
