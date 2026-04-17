/**
 * /leaderboard command — Top SolFoundry contributors by completed bounties.
 */

import type { ChatInputCommandInteraction } from 'discord.js';
import { EmbedBuilder } from 'discord.js';
import { fetchContributors, formatReward } from '../services/api-client.js';

export async function leaderboardCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const limit = interaction.options.getInteger('limit') ?? 10;

  try {
    const contributors = await fetchContributors({ sort_by: 'bounties_completed', order: 'desc', limit: String(limit) });

    if (!contributors.length) {
      await interaction.editReply('No contributors found yet. The leaderboard is waiting for its first champions! 🏆');
      return;
    }

    const medals = ['🥇', '🥈', '🥉'];
    const entries = contributors.slice(0, limit).map((c, i) => {
      const medal = medals[i] ?? `**#${i + 1}**`;
      return `${medal} **${c.username}** — ${c.bounties_completed} bounties · ${formatReward(c.total_earned)} · ⭐ ${c.reputation_score}`;
    });

    const embed = new EmbedBuilder()
      .setColor(0xfbbf24)
      .setTitle('🏆 SolFoundry Leaderboard')
      .setDescription(entries.join('\n'))
      .setTimestamp()
      .setFooter({ text: `Top ${Math.min(limit, contributors.length)} contributors` });

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('Leaderboard fetch error:', err);
    await interaction.editReply('❌ Could not fetch leaderboard. The SolFoundry API may be unavailable.');
  }
}