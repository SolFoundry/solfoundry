/**
 * Leaderboard slash command for the Discord bot.
 *
 * Displays top contributors by bounty earnings and completions.
 * Supports optional limit parameter and platform stats.
 *
 * @module leaderboard-command
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import type { SolFoundryApiClient } from '../services/api-client.js';
import type { Logger } from '../utils/logger.js';
import { createLeaderboardEmbed } from '../utils/embeds.js';

/** Command data for registration. */
export const leaderboardCommandData: RESTPostAPIChatInputApplicationCommandsJSONBody = {
  name: 'leaderboard',
  description: 'Show the top SolFoundry contributors by bounty earnings',
  options: [
    {
      name: 'limit',
      description: 'Number of top contributors to show (default: 10)',
      type: 4, // INTEGER
      required: false,
      min_value: 1,
      max_value: 25,
    },
  ],
} as const;

/**
 * Handle the /leaderboard command.
 *
 * @param interaction - The Discord interaction.
 * @param apiClient - SolFoundry API client.
 * @param logger - Logger instance.
 */
export async function handleLeaderboard(
  interaction: ChatInputCommandInteraction,
  apiClient: SolFoundryApiClient,
  logger: Logger,
): Promise<void> {
  try {
    await interaction.deferReply({ ephemeral: false });

    const limit = interaction.options.getInteger('limit') ?? 10;
    logger.info(`Leaderboard command: limit=${limit}`);

    // Fetch leaderboard data
    const [contributors, stats] = await Promise.all([
      apiClient.fetchLeaderboard(limit),
      apiClient.fetchStats(),
    ]);

    // Transform to leaderboard entries
    const entries = contributors.map((c, index) => ({
      rank: index + 1,
      username: c.username,
      bountiesCompleted: c.bounties_completed,
      totalEarnings: c.total_earnings || 0,
      reputationScore: c.reputation_score || 0,
    }));

    const embed = createLeaderboardEmbed(entries, {
      totalBountiesCompleted: stats.total_bounties_completed,
      totalFndryPaid: stats.total_fndry_paid,
      totalContributors: stats.total_contributors,
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Error handling leaderboard command', error);
    const errorMessage = 'Failed to fetch leaderboard data. Please try again later.';
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(errorMessage);
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}
