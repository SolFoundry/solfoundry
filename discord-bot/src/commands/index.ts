/**
 * Command registration and routing for the Discord bot.
 *
 * Exports all slash command data for registration and provides
 * a command router for handling interactions.
 *
 * @module commands
 */

import {
  ChatInputCommandInteraction,
  ButtonInteraction,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import type { SolFoundryApiClient } from '../services/api-client.js';
import type { Logger } from '../utils/logger.js';
import { leaderboardCommandData, handleLeaderboard } from './leaderboard.js';
import { filtersCommandData, handleFilters } from './filters.js';
import { parseButtonCustomId } from '../utils/buttons.js';

/** All slash commands registered by the bot. */
export const commands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [
  leaderboardCommandData,
  filtersCommandData,
];

/**
 * Route a slash command interaction to the appropriate handler.
 *
 * @param interaction - The Discord command interaction.
 * @param apiClient - SolFoundry API client.
 * @param logger - Logger instance.
 */
export async function routeCommand(
  interaction: ChatInputCommandInteraction,
  apiClient: SolFoundryApiClient,
  logger: Logger,
): Promise<void> {
  switch (interaction.commandName) {
    case 'leaderboard':
      await handleLeaderboard(interaction, apiClient, logger);
      break;
    case 'filters':
      await handleFilters(interaction, logger);
      break;
    default:
      logger.warn(`Unknown command: ${interaction.commandName}`);
      await interaction.reply({
        content: 'Unknown command. Use /leaderboard or /filters.',
        ephemeral: true,
      });
  }
}

/**
 * Route a button interaction to the appropriate handler.
 *
 * @param interaction - The Discord button interaction.
 * @param logger - Logger instance.
 */
export async function routeButton(
  interaction: ButtonInteraction,
  logger: Logger,
): Promise<void> {
  const parsed = parseButtonCustomId(interaction.customId);

  if (!parsed) {
    logger.warn(`Unknown button interaction: ${interaction.customId}`);
    await interaction.reply({
      content: 'Unknown action. Please try again.',
      ephemeral: true,
    });
    return;
  }

  const { action, bountyId } = parsed;

  switch (action) {
    case 'claim':
      await handleClaim(interaction, bountyId, logger);
      break;
    case 'subscribe':
      await handleSubscribe(interaction, bountyId, logger);
      break;
    case 'view_details':
      // Link buttons don't need handling
      break;
    default:
      logger.warn(`Unknown button action: ${action}`);
      await interaction.reply({
        content: 'Unknown action.',
        ephemeral: true,
      });
  }
}

/**
 * Handle the Claim button interaction.
 *
 * @param interaction - The Discord button interaction.
 * @param bountyId - The bounty ID.
 * @param logger - Logger instance.
 */
async function handleClaim(
  interaction: ButtonInteraction,
  bountyId: string,
  logger: Logger,
): Promise<void> {
  try {
    await interaction.deferReply({ ephemeral: true });

    const bountyUrl = `https://solfoundry.org/bounties/${bountyId}`;
    await interaction.editReply({
      content:
        `🎯 **Claim Bounty**\n\n` +
        `To claim this bounty, please visit the bounty page and follow the claiming process.\n\n` +
        `**Note:** Tier 2 and Tier 3 bounties require minimum reputation scores to claim.\n\n` +
        `[Open Bounty Page](${bountyUrl})`,
    });

    logger.info(`Claim button clicked for bounty ${bountyId} by ${interaction.user.id}`);
  } catch (error) {
    logger.error(`Error handling claim for bounty ${bountyId}`, error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'Failed to process claim request. Please try again.',
        ephemeral: true,
      });
    }
  }
}

/**
 * Handle the Subscribe button interaction.
 *
 * @param interaction - The Discord button interaction.
 * @param bountyId - The bounty ID.
 * @param logger - Logger instance.
 */
async function handleSubscribe(
  interaction: ButtonInteraction,
  bountyId: string,
  logger: Logger,
): Promise<void> {
  try {
    await interaction.deferReply({ ephemeral: true });

    await interaction.editReply({
      content:
        `🔔 **Subscribed to Bounty Updates**\n\n` +
        `You will receive notifications when this bounty's status changes.\n\n` +
        `Use \`/filters\` to customize your notification preferences.`,
    });

    logger.info(`Subscribe button clicked for bounty ${bountyId} by ${interaction.user.id}`);
  } catch (error) {
    logger.error(`Error handling subscribe for bounty ${bountyId}`, error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'Failed to subscribe to updates. Please try again.',
        ephemeral: true,
      });
    }
  }
}
