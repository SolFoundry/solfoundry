/**
 * Tests for the embed builder utilities.
 *
 * Validates bounty embed creation, status update embeds,
 * leaderboard embeds, and filter confirmation embeds.
 */

import { describe, it, expect } from 'vitest';
import {
  createBountyEmbed,
  createStatusUpdateEmbed,
  createLeaderboardEmbed,
  createFilterConfirmationEmbed,
  type BountyData,
  type StatusUpdateData,
  type LeaderboardEntry,
} from '../utils/embeds.js';

// ---------------------------------------------------------------------------
// Bounty Embed Tests
// ---------------------------------------------------------------------------

describe('createBountyEmbed', () => {
  const sampleBounty: BountyData = {
    id: 'bounty-123',
    title: 'Implement Search API',
    description: 'Build a full-text search endpoint for the bounty board',
    tier: 2,
    category: 'backend',
    rewardAmount: 500,
    status: 'open',
    deadline: '2026-06-15T00:00:00Z',
    githubIssueUrl: 'https://github.com/SolFoundry/solfoundry/issues/42',
    requiredSkills: ['typescript', 'node.js', 'elasticsearch'],
    createdAt: '2026-03-22T00:00:00Z',
  };

  it('should create an embed with correct title and URL', () => {
    const embed = createBountyEmbed(sampleBounty);
    const data = embed.data;

    expect(data.title).toContain('Implement Search API');
    expect(data.url).toBe('https://github.com/SolFoundry/solfoundry/issues/42');
  });

  it('should include reward amount in fields', () => {
    const embed = createBountyEmbed(sampleBounty);
    const fields = embed.data.fields || [];

    const rewardField = fields.find((f) => f.name === '💰 Reward');
    expect(rewardField).toBeDefined();
    expect(rewardField!.value).toContain('500');
    expect(rewardField!.value).toContain('$FNDRY');
  });

  it('should include tier information', () => {
    const embed = createBountyEmbed(sampleBounty);
    const fields = embed.data.fields || [];

    const tierField = fields.find((f) => f.name === '📊 Tier');
    expect(tierField).toBeDefined();
    expect(tierField!.value).toContain('Tier 2');
  });

  it('should use tier-appropriate color', () => {
    const t2Bounty = { ...sampleBounty, tier: 2 };
    const embed = createBountyEmbed(t2Bounty);
    // Tier 2 color: 0xf59e0b (amber)
    expect(embed.data.color).toBe(0xf59e0b);
  });

  it('should use green color for Tier 1', () => {
    const t1Bounty = { ...sampleBounty, tier: 1 };
    const embed = createBountyEmbed(t1Bounty);
    expect(embed.data.color).toBe(0x22c55e);
  });

  it('should use red color for Tier 3', () => {
    const t3Bounty = { ...sampleBounty, tier: 3 };
    const embed = createBountyEmbed(t3Bounty);
    expect(embed.data.color).toBe(0xef4444);
  });

  it('should include skills field when skills are present', () => {
    const embed = createBountyEmbed(sampleBounty);
    const fields = embed.data.fields || [];

    const skillsField = fields.find((f) => f.name === '🛠️ Required Skills');
    expect(skillsField).toBeDefined();
    expect(skillsField!.value).toContain('typescript');
    expect(skillsField!.value).toContain('node.js');
  });

  it('should truncate long descriptions', () => {
    const longBounty = {
      ...sampleBounty,
      description: 'x'.repeat(600),
    };
    const embed = createBountyEmbed(longBounty);
    expect(embed.data.description!.length).toBeLessThanOrEqual(500);
    expect(embed.data.description).toContain('...');
  });

  it('should handle missing optional fields', () => {
    const minimalBounty: BountyData = {
      id: 'bounty-456',
      title: 'Minimal Bounty',
      description: '',
      tier: 1,
      category: null,
      rewardAmount: 100,
      status: 'open',
      deadline: null,
      githubIssueUrl: null,
      requiredSkills: [],
      createdAt: '2026-03-22T00:00:00Z',
    };

    const embed = createBountyEmbed(minimalBounty);
    expect(embed.data.title).toContain('Minimal Bounty');
    expect(embed.data.fields).toBeDefined();
  });

  it('should include deadline with days remaining', () => {
    const embed = createBountyEmbed(sampleBounty);
    const fields = embed.data.fields || [];

    const deadlineField = fields.find((f) => f.name === '⏰ Deadline');
    expect(deadlineField).toBeDefined();
    expect(deadlineField!.value).toContain('days left');
  });

  it('should include category when present', () => {
    const embed = createBountyEmbed(sampleBounty);
    const fields = embed.data.fields || [];

    const categoryField = fields.find((f) => f.name === '🏷️ Category');
    expect(categoryField).toBeDefined();
    expect(categoryField!.value).toContain('backend');
  });

  it('should set footer with bounty ID', () => {
    const embed = createBountyEmbed(sampleBounty);
    expect(embed.data.footer).toBeDefined();
    expect(embed.data.footer!.text).toContain('Bounty #bounty-1');
  });
});

// ---------------------------------------------------------------------------
// Status Update Embed Tests
// ---------------------------------------------------------------------------

describe('createStatusUpdateEmbed', () => {
  const sampleUpdate: StatusUpdateData = {
    bountyId: 'bounty-123',
    title: 'Implement Search API',
    oldStatus: 'open',
    newStatus: 'in_progress',
    githubIssueUrl: 'https://github.com/SolFoundry/solfoundry/issues/42',
  };

  it('should show status change in fields', () => {
    const embed = createStatusUpdateEmbed(sampleUpdate);
    const fields = embed.data.fields || [];

    const statusField = fields.find((f) => f.name === '📊 Status Change');
    expect(statusField).toBeDefined();
    expect(statusField!.value).toContain('Open');
    expect(statusField!.value).toContain('In Progress');
    expect(statusField!.value).toContain('→');
  });

  it('should use success color for completed status', () => {
    const completedUpdate = { ...sampleUpdate, newStatus: 'completed' };
    const embed = createStatusUpdateEmbed(completedUpdate);
    expect(embed.data.color).toBe(0x22c55e);
  });

  it('should use danger color for disputed status', () => {
    const disputedUpdate = { ...sampleUpdate, newStatus: 'disputed' };
    const embed = createStatusUpdateEmbed(disputedUpdate);
    expect(embed.data.color).toBe(0xef4444);
  });

  it('should use warning color for in_progress status', () => {
    // in_progress maps to warning (amber) color, not info
    const progressUpdate = { ...sampleUpdate, newStatus: 'in_progress' };
    const embed = createStatusUpdateEmbed(progressUpdate);
    expect(embed.data.color).toBe(0xf59e0b);
  });

  it('should use info color for under_review status change', () => {
    const reviewUpdate = { ...sampleUpdate, newStatus: 'under_review' };
    const embed = createStatusUpdateEmbed(reviewUpdate);
    expect(embed.data.color).toBe(0x6366f1);
  });

  it('should include bounty ID in footer', () => {
    const embed = createStatusUpdateEmbed(sampleUpdate);
    expect(embed.data.footer!.text).toContain('Bounty #bounty-1');
  });
});

// ---------------------------------------------------------------------------
// Leaderboard Embed Tests
// ---------------------------------------------------------------------------

describe('createLeaderboardEmbed', () => {
  const sampleEntries: LeaderboardEntry[] = [
    { rank: 1, username: 'alice', bountiesCompleted: 15, totalEarnings: 7500, reputationScore: 95 },
    { rank: 2, username: 'bob', bountiesCompleted: 12, totalEarnings: 6000, reputationScore: 88 },
    { rank: 3, username: 'charlie', bountiesCompleted: 8, totalEarnings: 4000, reputationScore: 72 },
  ];

  const sampleStats = {
    totalBountiesCompleted: 150,
    totalFndryPaid: 75000,
    totalContributors: 42,
  };

  it('should have correct title', () => {
    const embed = createLeaderboardEmbed(sampleEntries, sampleStats);
    expect(embed.data.title).toContain('Leaderboard');
  });

  it('should include platform stats when provided', () => {
    const embed = createLeaderboardEmbed(sampleEntries, sampleStats);
    const fields = embed.data.fields || [];

    const statsField = fields.find((f) => f.name === '📊 Platform Stats');
    expect(statsField).toBeDefined();
    expect(statsField!.value).toContain('150');
    expect(statsField!.value).toContain('75,000');
  });

  it('should show medal emojis for top 3', () => {
    const embed = createLeaderboardEmbed(sampleEntries, sampleStats);
    const fields = embed.data.fields || [];

    const leaderboardField = fields.find((f) => f.name === '🏅 Top Contributors');
    expect(leaderboardField!.value).toContain('🥇');
    expect(leaderboardField!.value).toContain('🥈');
    expect(leaderboardField!.value).toContain('🥉');
  });

  it('should show numbered ranks for entries beyond top 3', () => {
    const entriesWithMore = [
      ...sampleEntries,
      { rank: 4, username: 'dave', bountiesCompleted: 5, totalEarnings: 2500, reputationScore: 60 },
    ];
    const embed = createLeaderboardEmbed(entriesWithMore, sampleStats);
    const fields = embed.data.fields || [];

    const leaderboardField = fields.find((f) => f.name === '🏅 Top Contributors');
    expect(leaderboardField!.value).toContain('#4');
  });

  it('should limit to 10 entries', () => {
    const manyEntries = Array.from({ length: 15 }, (_, i) => ({
      rank: i + 1,
      username: `user${i}`,
      bountiesCompleted: 10 - i,
      totalEarnings: (10 - i) * 500,
      reputationScore: 90 - i * 5,
    }));

    const embed = createLeaderboardEmbed(manyEntries, sampleStats);
    const fields = embed.data.fields || [];
    const leaderboardField = fields.find((f) => f.name === '🏅 Top Contributors');

    // Count the number of entries (each on its own line)
    const lines = leaderboardField!.value.split('\n');
    expect(lines.length).toBeLessThanOrEqual(10);
  });

  it('should show empty state message when no entries', () => {
    const embed = createLeaderboardEmbed([], sampleStats);
    const fields = embed.data.fields || [];

    const emptyField = fields.find((f) => f.name === 'No data yet');
    expect(emptyField).toBeDefined();
  });

  it('should include footer with link', () => {
    const embed = createLeaderboardEmbed(sampleEntries, sampleStats);
    expect(embed.data.footer!.text).toContain('solfoundry.org');
  });
});

// ---------------------------------------------------------------------------
// Filter Confirmation Embed Tests
// ---------------------------------------------------------------------------

describe('createFilterConfirmationEmbed', () => {
  it('should show selected tiers', () => {
    const embed = createFilterConfirmationEmbed({
      tiers: [1, 2],
      minReward: 0,
      categories: [],
      statuses: [],
    });
    const fields = embed.data.fields || [];

    const tierField = fields.find((f) => f.name === '📊 Tiers');
    expect(tierField!.value).toContain('Tier 1, 2');
  });

  it('should show "All tiers" when no tiers selected', () => {
    const embed = createFilterConfirmationEmbed({
      tiers: [],
      minReward: 0,
      categories: [],
      statuses: [],
    });
    const fields = embed.data.fields || [];

    const tierField = fields.find((f) => f.name === '📊 Tiers');
    expect(tierField!.value).toContain('All tiers');
  });

  it('should show minimum reward', () => {
    const embed = createFilterConfirmationEmbed({
      tiers: [],
      minReward: 500,
      categories: [],
      statuses: [],
    });
    const fields = embed.data.fields || [];

    const rewardField = fields.find((f) => f.name === '💰 Min Reward');
    expect(rewardField!.value).toContain('500');
    expect(rewardField!.value).toContain('$FNDRY');
  });

  it('should show categories when specified', () => {
    const embed = createFilterConfirmationEmbed({
      tiers: [],
      minReward: 0,
      categories: ['frontend', 'backend'],
      statuses: [],
    });
    const fields = embed.data.fields || [];

    const categoryField = fields.find((f) => f.name === '🏷️ Categories');
    expect(categoryField).toBeDefined();
    expect(categoryField!.value).toContain('frontend');
    expect(categoryField!.value).toContain('backend');
  });

  it('should show success color', () => {
    const embed = createFilterConfirmationEmbed({
      tiers: [],
      minReward: 0,
      categories: [],
      statuses: [],
    });
    expect(embed.data.color).toBe(0x22c55e);
  });
});
