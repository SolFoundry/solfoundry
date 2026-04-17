/**
 * /clearfilter command — Remove all user notification filters.
 */

import type { ChatInputCommandInteraction } from 'discord.js';
import { clearFilter } from '../services/filter-store.js';

export async function clearfilterCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const cleared = clearFilter(interaction.user.id, interaction.guildId!);

  if (cleared) {
    await interaction.reply({ content: '🗑️ All notification filters cleared. You\'ll see all bounties in the bounty channel.', ephemeral: true });
  } else {
    await interaction.reply({ content: '📭 You have no filters to clear.', ephemeral: true });
  }
}