/**
 * /setfilter command — Set notification filters for the user.
 */

import type { ChatInputCommandInteraction } from 'discord.js';
import { EmbedBuilder } from 'discord.js';
import { setFilter, getFilter } from '../services/filter-store.js';

export async function setfilterCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;
  const guildId = interaction.guildId!;
  const category = interaction.options.getString('category');
  const minTier = interaction.options.getInteger('min_tier');
  const maxTier = interaction.options.getInteger('max_tier');
  const minReward = interaction.options.getInteger('min_reward');

  if (!category && minTier === null && maxTier === null && minReward === null) {
    await interaction.reply({ content: '❌ Provide at least one filter option. Use `/filters` to see available options.', ephemeral: true });
    return;
  }

  // Validate tier range
  if (minTier !== null && maxTier !== null && minTier > maxTier) {
    await interaction.reply({ content: '❌ `min_tier` cannot be greater than `max_tier`.', ephemeral: true });
    return;
  }

  const updated = setFilter(userId, guildId, {
    category: category ?? undefined,
    min_tier: minTier ?? undefined,
    max_tier: maxTier ?? undefined,
    min_reward: minReward ?? undefined,
  } as any);

  const fields = [];
  if (updated.category) fields.push(`📂 Category: **${updated.category}**`);
  if (updated.min_tier) fields.push(`⬆️ Min Tier: **T${updated.min_tier}**`);
  if (updated.max_tier) fields.push(`⬇️ Max Tier: **T${updated.max_tier}**`);
  if (updated.min_reward) fields.push(`💰 Min Reward: **${updated.min_reward.toLocaleString()} $FNDRY**`);

  const embed = new EmbedBuilder()
    .setColor(0x00d4aa)
    .setTitle('✅ Notification Filters Updated')
    .setDescription(`You'll be DM'd when new bounties match:\n${fields.join('\n')}`)
    .setFooter({ text: 'Use /myfilters to view, /clearfilter to remove' });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}