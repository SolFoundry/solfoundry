import { describe, expect, it } from 'vitest';
import { analyticsCsv, buildAnalyticsMetrics } from '../api/analytics';
import type { Bounty } from '../types/bounty';
import type { LeaderboardEntry } from '../types/leaderboard';

const bounties: Bounty[] = [
  {
    id: 'b1',
    title: 'Open UI bounty',
    description: 'Build UI',
    status: 'open',
    tier: 'T1',
    reward_amount: 100,
    reward_token: 'FNDRY',
    skills: ['React'],
    submission_count: 0,
    created_at: '2026-05-01T00:00:00Z',
  },
  {
    id: 'b2',
    title: 'Completed API bounty',
    description: 'Build API',
    status: 'completed',
    tier: 'T2',
    reward_amount: 250,
    reward_token: 'USDC',
    skills: ['TypeScript'],
    submission_count: 2,
    created_at: '2026-05-02T00:00:00Z',
  },
];

const leaderboard: LeaderboardEntry[] = [
  {
    rank: 1,
    username: 'alice',
    points: 100,
    bountiesCompleted: 2,
    earningsFndry: 1000,
    earningsSol: 0,
    topSkills: ['React'],
    reputation: 90,
    stakedFndry: 0,
    reputationBoost: 1,
  },
];

describe('analytics metrics', () => {
  it('derives dashboard metrics from existing bounties and leaderboard entries', () => {
    const metrics = buildAnalyticsMetrics(bounties, leaderboard);

    expect(metrics.openBounties).toBe(1);
    expect(metrics.completedBounties).toBe(1);
    expect(metrics.totalReward).toBe(350);
    expect(metrics.activeContributors).toBe(1);
    expect(metrics.completionRate).toBe(50);
    expect(metrics.rewardByToken).toEqual({ FNDRY: 100, USDC: 250 });
    expect(metrics.payoutDistribution).toHaveLength(2);
  });

  it('exports core metrics as csv', () => {
    const csv = analyticsCsv(buildAnalyticsMetrics(bounties, leaderboard));

    expect(csv).toContain('metric,value');
    expect(csv).toContain('open_bounties,1');
    expect(csv).toContain('total_reward,350');
  });
});
