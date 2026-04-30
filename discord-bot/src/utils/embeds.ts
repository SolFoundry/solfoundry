/**
 * Discord embed builders for SolFoundry bounty notifications.
 *
 * Creates rich, formatted embeds for bounty posts, status updates,
 * and leaderboard displays following SolFoundry branding.
 *
 * @module embeds
 */

import { EmbedBuilder } from 'discord.js';

/** Bounty data shape for embed creation. */
export interface BountyData {
  id: string;
  title: string;
  description: string;
  tier: number;
  category: string | null;
  rewardAmount: number;
  status: string;
  deadline: string | null;
  githubIssueUrl: string | null;
  requiredSkills: string[];
  createdAt: string;
}

/** Top contributor data for leaderboard embeds. */
export interface LeaderboardEntry {
  rank: number;
  username: string;
  bountiesCompleted: number;
  totalEarnings: number;
  reputationScore: number;
}

/** Status change data for update embeds. */
export interface StatusUpdateData {
  bountyId: string;
  title: string;
  oldStatus: string;
  newStatus: string;
  githubIssueUrl: string | null;
}

/** SolFoundry brand colors. */
const BRAND_COLORS = {
  primary: 0x00d4aa, // Teal accent
  success: 0x22c55e, // Green
  warning: 0xf59e0b, // Amber
  danger: 0xef4444, // Red
  info: 0x6366f1, // Indigo
  tier1: 0x22c55e, // Green for T1
  tier2: 0xf59e0b, // Amber for T2
  tier3: 0xef4444, // Red for T3
} as const;

/** Status emoji mapping for visual clarity. */
const STATUS_EMOJI: Record<string, string> = {
  draft: '📝',
  open: '🟢',
  in_progress: '🔨',
  under_review: '🔍',
  completed: '✅',
  disputed: '⚖️',
  paid: '💰',
  cancelled: '❌',
};

/** Tier emoji mapping. */
const TIER_EMOJI: Record<number, string> = {
  1: '🥉',
  2: '🥈',
  3: '🥇',
};

/**
 * Create a rich embed for a new bounty announcement.
 *
 * @param bounty - The bounty data.
 * @returns A configured EmbedBuilder ready for sending.
 */
export function createBountyEmbed(bounty: BountyData): EmbedBuilder {
  const tierEmoji = TIER_EMOJI[bounty.tier] || '🏷️';
  const statusEmoji = STATUS_EMOJI[bounty.status] || '📋';
  const tierColor =
    bounty.tier === 1 ? BRAND_COLORS.tier1 : bounty.tier === 2 ? BRAND_COLORS.tier2 : BRAND_COLORS.tier3;

  const embed = new EmbedBuilder()
    .setColor(tierColor)
    .setTitle(`${tierEmoji} ${bounty.title}`)
    .setURL(bounty.githubIssueUrl || undefined)
    .setDescription(
      bounty.description.length > 500
        ? `${bounty.description.substring(0, 497)}...`
        : bounty.description || 'No description provided.',
    )
    .addFields(
      {
        name: '💰 Reward',
        value: `**${bounty.rewardAmount.toLocaleString()} $FNDRY**`,
        inline: true,
      },
      {
        name: '📊 Tier',
        value: `**Tier ${bounty.tier}** ${tierEmoji}`,
        inline: true,
      },
      {
        name: '📋 Status',
        value: `${statusEmoji} **${formatStatus(bounty.status)}**`,
        inline: true,
      },
    );

  // Add category field if available
  if (bounty.category) {
    embed.addFields({
      name: '🏷️ Category',
      value: `**${bounty.category}**`,
      inline: true,
    });
  }

  // Add deadline field if available
  if (bounty.deadline) {
    const deadlineDate = new Date(bounty.deadline);
    const now = new Date();
    const daysLeft = Math.max(0, Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    embed.addFields({
      name: '⏰ Deadline',
      value: `**${deadlineDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}** (${daysLeft} days left)`,
      inline: true,
    });
  }

  // Add skills field if available
  if (bounty.requiredSkills.length > 0) {
    const skillsText = bounty.requiredSkills.slice(0, 8).join(', ');
    embed.addFields({
      name: '🛠️ Required Skills',
      value: skillsText + (bounty.requiredSkills.length > 8 ? '...' : ''),
      inline: false,
    });
  }

  // Add footer with timestamp
  embed.setFooter({
    text: `Bounty #${bounty.id.slice(0, 8)} • Posted ${new Date(bounty.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
  });

  return embed;
}

/**
 * Create an embed for a bounty status update notification.
 *
 * @param update - The status update data.
 * @returns A configured EmbedBuilder ready for sending.
 */
export function createStatusUpdateEmbed(update: StatusUpdateData): EmbedBuilder {
  const oldEmoji = STATUS_EMOJI[update.oldStatus] || '📋';
  const newEmoji = STATUS_EMOJI[update.newStatus] || '📋';

  let color: number = BRAND_COLORS.info;
  if (update.newStatus === 'completed' || update.newStatus === 'paid') {
    color = BRAND_COLORS.success;
  } else if (update.newStatus === 'disputed') {
    color = BRAND_COLORS.danger;
  } else if (update.newStatus === 'in_progress') {
    color = BRAND_COLORS.warning;
  }

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${newEmoji} Bounty Status Updated: ${update.title}`)
    .setURL(update.githubIssueUrl || undefined)
    .addFields(
      {
        name: '📊 Status Change',
        value: `${oldEmoji} **${formatStatus(update.oldStatus)}** → ${newEmoji} **${formatStatus(update.newStatus)}**`,
        inline: false,
      },
    )
    .setFooter({
      text: `Bounty #${update.bountyId.slice(0, 8)}`,
    });

  return embed;
}

/**
 * Create a leaderboard embed showing top contributors.
 *
 * @param entries - The leaderboard entries (max 10).
 * @param totalStats - Optional aggregate stats.
 * @returns A configured EmbedBuilder ready for sending.
 */
export function createLeaderboardEmbed(
  entries: LeaderboardEntry[],
  totalStats?: { totalBountiesCompleted: number; totalFndryPaid: number; totalContributors: number },
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLORS.primary)
    .setTitle('🏆 SolFoundry Leaderboard')
    .setDescription('Top contributors by bounty earnings and completions');

  // Add aggregate stats if available
  if (totalStats) {
    embed.addFields({
      name: '📊 Platform Stats',
      value: [
        `**${totalStats.totalBountiesCompleted}** bounties completed`,
        `**${totalStats.totalFndryPaid.toLocaleString()} $FNDRY** paid out`,
        `**${totalStats.totalContributors}** contributors`,
      ].join(' • '),
      inline: false,
    });
  }

  // Add leaderboard entries
  if (entries.length === 0) {
    embed.addFields({
      name: 'No data yet',
      value: 'Be the first to complete a bounty! 🚀',
      inline: false,
    });
  } else {
    const leaderboardText = entries
      .slice(0, 10)
      .map((entry) => {
        const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`;
        return `${medal} **${entry.username}** — ${entry.bountiesCompleted} bounties • ${entry.totalEarnings.toLocaleString()} $FNDRY`;
      })
      .join('\n');

    embed.addFields({
      name: '🏅 Top Contributors',
      value: leaderboardText,
      inline: false,
    });
  }

  embed.setFooter({
    text: 'SolFoundry Bounty Platform • https://solfoundry.org',
  });

  return embed;
}

/**
 * Create an embed for filter configuration confirmation.
 *
 * @param filters - The configured filters.
 * @returns A configured EmbedBuilder.
 */
export function createFilterConfirmationEmbed(filters: {
  tiers: number[];
  minReward: number;
  categories: string[];
  statuses: string[];
}): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLORS.success)
    .setTitle('✅ Notification Filters Updated')
    .setDescription('Your bounty notification preferences have been saved.');

  embed.addFields(
    {
      name: '📊 Tiers',
      value: filters.tiers.length > 0 ? `Tier ${filters.tiers.join(', ')}` : 'All tiers',
      inline: true,
    },
    {
      name: '💰 Min Reward',
      value: filters.minReward > 0 ? `${filters.minReward.toLocaleString()} $FNDRY` : 'No minimum',
      inline: true,
    },
  );

  if (filters.categories.length > 0) {
    embed.addFields({
      name: '🏷️ Categories',
      value: filters.categories.join(', '),
      inline: false,
    });
  }

  if (filters.statuses.length > 0) {
    embed.addFields({
      name: '📋 Statuses',
      value: filters.statuses.map(formatStatus).join(', '),
      inline: false,
    });
  }

  return embed;
}

/**
 * Format a status string for display.
 *
 * @param status - The raw status string.
 * @returns Human-readable status.
 */
function formatStatus(status: string): string {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
