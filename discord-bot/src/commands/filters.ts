/**
 * /filters command — Show available categories and tier levels.
 */

import type { ChatInputCommandInteraction } from 'discord.js';
import { EmbedBuilder } from 'discord.js';

export async function filtersCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle('🔍 Available Notification Filters')
    .addFields(
      {
        name: 'Categories',
        value: [
          '`backend` — Server-side, APIs, databases',
          '`frontend` — UI, components, styling',
          '`smart-contract` — Solana programs, Rust',
          '`devops` — CI/CD, infrastructure, deployment',
          '`docs` — Documentation, guides, tutorials',
          '`design` — UX/UI, graphics, branding',
          '`testing` — QA, unit/integration tests',
        ].join('\n'),
        inline: false,
      },
      {
        name: 'Tier Levels',
        value: [
          '🟢 **T1** — Entry-level bounties (smaller rewards)',
          '🟡 **T2** — Mid-level bounties (moderate rewards)',
          '🔴 **T3** — Expert-level bounties (large rewards)',
        ].join('\n'),
        inline: false,
      },
      {
        name: 'How to Set Filters',
        value: [
          '`/setfilter category:backend` — Filter by category',
          '`/setfilter min_tier:2` — Only T2 and above',
          '`/setfilter min_reward:100000` — Min 100K $FNDRY',
          '`/setfilter category:smart-contract min_tier:2 max_tier:3` — Combine filters',
          '`/clearfilter` — Remove all filters',
          '`/myfilters` — View your current filters',
        ].join('\n'),
        inline: false,
      },
    )
    .setFooter({ text: 'Filters are AND-combined — all conditions must match' });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}