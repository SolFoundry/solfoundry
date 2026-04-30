/**
 * Notification filters command for the Discord bot.
 *
 * Allows users to customize their bounty notification preferences
 * including tier, reward level, category, and status filters.
 *
 * @module filters-command
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import type { Logger } from '../utils/logger.js';
import { createFilterConfirmationEmbed } from '../utils/embeds.js';

/** User filter configuration stored in memory. */
interface UserFilters {
  tiers: number[];
  minReward: number;
  categories: string[];
  statuses: string[];
}

/** In-memory filter store keyed by Discord user ID. */
const userFilters: Map<string, UserFilters> = new Map();

/** Command data for registration. */
export const filtersCommandData: RESTPostAPIChatInputApplicationCommandsJSONBody = {
  name: 'filters',
  description: 'Configure your bounty notification preferences',
  options: [
    {
      name: 'tiers',
      description: 'Comma-separated tier numbers to follow (e.g., 1,2,3)',
      type: 3, // STRING
      required: false,
      max_length: 50,
    },
    {
      name: 'min_reward',
      description: 'Minimum reward amount in $FNDRY',
      type: 4, // INTEGER
      required: false,
      min_value: 0,
      max_value: 100000,
    },
    {
      name: 'categories',
      description: 'Comma-separated categories to follow (e.g., frontend,backend)',
      type: 3, // STRING
      required: false,
      max_length: 200,
    },
    {
      name: 'reset',
      description: 'Reset all filters to defaults',
      type: 5, // BOOLEAN
      required: false,
    },
  ],
} as const;

/**
 * Handle the /filters command.
 *
 * @param interaction - The Discord interaction.
 * @param logger - Logger instance.
 */
export async function handleFilters(
  interaction: ChatInputCommandInteraction,
  logger: Logger,
): Promise<void> {
  try {
    const userId = interaction.user.id;
    const reset = interaction.options.getBoolean('reset') ?? false;

    if (reset) {
      // Reset filters to defaults
      userFilters.delete(userId);
      const embed = createFilterConfirmationEmbed({
        tiers: [],
        minReward: 0,
        categories: [],
        statuses: [],
      });
      embed.setTitle('🔄 Notification Filters Reset');
      embed.setDescription('All filters have been reset to receive all bounty notifications.');

      await interaction.reply({ embeds: [embed], ephemeral: true });
      logger.info(`Filters reset for user: ${userId}`);
      return;
    }

    // Get or create user filters
    let filters = userFilters.get(userId) ?? {
      tiers: [],
      minReward: 0,
      categories: [],
      statuses: [],
    };

    // Parse tier filter
    const tiersInput = interaction.options.getString('tiers');
    if (tiersInput) {
      filters.tiers = tiersInput
        .split(',')
        .map((t) => parseInt(t.trim(), 10))
        .filter((t) => !Number.isNaN(t) && t >= 1 && t <= 3);
    }

    // Parse min reward filter
    const minReward = interaction.options.getInteger('min_reward');
    if (minReward !== null) {
      filters.minReward = minReward;
    }

    // Parse category filter
    const categoriesInput = interaction.options.getString('categories');
    if (categoriesInput) {
      filters.categories = categoriesInput
        .split(',')
        .map((c) => c.trim().toLowerCase())
        .filter((c) => c.length > 0);
    }

    // Save filters
    userFilters.set(userId, filters);

    const embed = createFilterConfirmationEmbed(filters);
    await interaction.reply({ embeds: [embed], ephemeral: true });
    logger.info(`Filters updated for user: ${userId}`);
  } catch (error) {
    logger.error('Error handling filters command', error);
    const errorMessage = 'Failed to update notification filters. Please try again.';
    if (!interaction.replied) {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}

/**
 * Check if a bounty matches a user's notification filters.
 *
 * @param userId - The Discord user ID.
 * @param bountyTier - The bounty's tier.
 * @param bountyReward - The bounty's reward amount.
 * @param bountyCategory - The bounty's category.
 * @returns True if the user should be notified.
 */
export function shouldNotifyUser(
  userId: string,
  bountyTier: number,
  bountyReward: number,
  bountyCategory: string | null,
): boolean {
  const filters = userFilters.get(userId);
  if (!filters) return true; // No filters = receive all

  // Check tier filter
  if (filters.tiers.length > 0 && !filters.tiers.includes(bountyTier)) {
    return false;
  }

  // Check minimum reward filter
  if (filters.minReward > 0 && bountyReward < filters.minReward) {
    return false;
  }

  // Check category filter
  if (filters.categories.length > 0 && bountyCategory) {
    if (!filters.categories.includes(bountyCategory.toLowerCase())) {
      return false;
    }
  }

  return true;
}

/**
 * Get filters for a user (for testing).
 *
 * @param userId - The Discord user ID.
 * @returns The user's filters or null if not set.
 */
export function getUserFilters(userId: string): UserFilters | null {
  return userFilters.get(userId) ?? null;
}

/**
 * Clear all filters (for testing).
 */
export function clearAllFilters(): void {
  userFilters.clear();
}
