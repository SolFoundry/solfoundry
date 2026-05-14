/**
 * Discord embed builders for SolFoundry bounty and leaderboard displays.
 */

import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { Bounty, LeaderboardEntry } from './api';

const FNDRY_EMOJI = '🤑';
const TIER_COLORS: Record<string, number> = {
  t1: 0x00E676, // emerald
  t2: 0xFFA726, // amber
  t3: 0xAB47BC, // purple
};

export function bountyEmbed(bounty: Bounty): EmbedBuilder {
  const color = TIER_COLORS[bounty.tier] ?? 0x00E676;
  const reward = (bounty.reward_amount / 1_000_000).toLocaleString();

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${FNDRY_EMOJI} ${bounty.title}`)
    .setURL(`${process.env.SOLFOUNDRY_API_URL ?? 'https://solfoundry.xyz'}/bounties/${bounty.id}`)
    .setDescription(bounty.description?.slice(0, 300) ?? 'No description')
    .addFields(
      { name: 'Reward', value: `${reward} $${bounty.reward_token}`, inline: true },
      { name: 'Tier', value: bounty.tier.toUpperCase(), inline: true },
      { name: 'Status', value: bounty.status, inline: true },
    )
    .setTimestamp(new Date(bounty.created_at));

  if (bounty.skills?.length) {
    embed.addFields({ name: 'Skills', value: bounty.skills.join(', '), inline: false });
  }

  if (bounty.deadline) {
    const deadline = new Date(bounty.deadline);
    embed.addFields({ name: 'Deadline', value: `<t:${Math.floor(deadline.getTime() / 1000)}:R>`, inline: true });
  }

  return embed;
}

export function leaderboardEmbed(entries: LeaderboardEntry[]): EmbedBuilder {
  const lines = entries.map((e, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**#${e.rank}**`;
    const earned = (e.total_earned / 1_000_000).toLocaleString();
    return `${medal} **${e.username}** — ${e.bounties_completed} bounties, ${earned} $FNDRY earned`;
  });

  return new EmbedBuilder()
    .setColor(0xFFD700) // gold
    .setTitle('🏆 SolFoundry Leaderboard')
    .setDescription(lines.join('\n'))
    .setTimestamp();
}

export function bountyButtons(bounty: Bounty): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel('View Bounty')
      .setStyle(ButtonStyle.Link)
      .setURL(`${process.env.SOLFOUNDRY_API_URL ?? 'https://solfoundry.xyz'}/bounties/${bounty.id}`),
    ...(bounty.github_issue_url
      ? [new ButtonBuilder().setLabel('GitHub Issue').setStyle(ButtonStyle.Link).setURL(bounty.github_issue_url)]
      : []),
  );
}
