/**
 * /myfilters command — Show user's current notification filters.
 */

import type { ChatInputCommandInteraction } from 'discord.js';
import { EmbedBuilder } from 'discord.js';
import { getFilter } from '../services/filter-store.js';

export async function myfiltersCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const filter = getFilter(interaction.user.id, interaction.guildId!);

  if (!filter) {
    await interaction.reply({ content: '📭 You have no notification filters set. You\'ll see all bounties in the bounty channel. Use `/setfilter` to customize.', ephemeral: true });
    return;
  }

  const fields = [];
  if (filter.category) fields.push(`📂 Category: **${filter.category}**`);
  else fields.push('📂 Category: Any');
  if (filter.min_tier) fields.push(`⬆️ Min Tier: **T${filter.min_tier}**`);
  else fields.push('⬆️ Min Tier: Any');
  if (filter.max_tier) fields.push(`⬇️ Max Tier: **T${filter.max_tier}**`);
  else fields.push('⬇️ Max Tier: Any');
  if (filter.min_reward) fields.push(`💰 Min Reward: **${filter.min_reward.toLocaleString()} $FNDRY**`);
  else fields.push('💰 Min Reward: Any');

  const embed = new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle('📬 Your Notification Filters')
    .setDescription(fields.join('\n'))
    .setFooter({ text: 'Use /setfilter to update, /clearfilter to remove all' });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}