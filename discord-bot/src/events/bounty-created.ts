/**
 * Bounty created event handler.
 *
 * Polls the SolFoundry API for new bounties and posts rich embeds
 * to the configured channel. Also sends DMs to users whose
 * filters match the new bounty.
 *
 * Uses polling as a reliable fallback; can be upgraded to
 * WebSocket events via the SDK's EventSubscriber.
 */

import type { Client, TextChannel } from 'discord.js';
import { EmbedBuilder } from 'discord.js';
import { fetchBounties, tierLabel, formatReward, type BountyListItem } from '../services/api-client.js';
import { getAllFilters, matchesFilter, initDB } from '../services/filter-store.js';

const POLL_INTERVAL_MS = 30_000; // 30 seconds
let knownBountyIds: Set<string> = new Set();
let isFirstPoll = true;

async function postBountyEmbed(client: Client, bounty: BountyListItem): Promise<void> {
  const channelId = process.env.BOUNTY_CHANNEL_ID!;
  const channel = await client.channels.fetch(channelId);
  if (!channel?.isTextBased()) {
    console.error(`Channel ${channelId} not found or not text-based`);
    return;
  }

  const skills = bounty.required_skills?.length
    ? bounty.required_skills.map((s) => `\`${s}\``).join(', ')
    : 'None specified';

  const deadline = bounty.deadline
    ? `<t:${Math.floor(new Date(bounty.deadline).getTime() / 1000)}:R>`
    : 'No deadline';

  const embed = new EmbedBuilder()
    .setColor(bounty.tier === 1 ? 0x00d4aa : bounty.tier === 2 ? 0xf59e0b : 0xef4444)
    .setTitle(`🏆 New Bounty: ${bounty.title}`)
    .addFields(
      { name: 'Tier', value: tierLabel(bounty.tier), inline: true },
      { name: 'Reward', value: formatReward(bounty.reward_amount), inline: true },
      { name: 'Category', value: bounty.category ?? 'General', inline: true },
      { name: 'Skills', value: skills, inline: false },
      { name: 'Deadline', value: deadline, inline: true },
      { name: 'Created By', value: bounty.created_by, inline: true },
    )
    .setTimestamp(new Date(bounty.created_at))
    .setFooter({ text: 'SolFoundry Bounty Board', iconURL: 'https://solfoundry.org/logo.png' });

  if (bounty.github_issue_url) {
    embed.addFields({ name: 'GitHub Issue', value: `[View Issue](${bounty.github_issue_url})`, inline: false });
  }

  await (channel as TextChannel).send({ embeds: [embed] });
}

async function notifyFilteredUsers(client: Client, bounty: BountyListItem, guildId: string): Promise<void> {
  const filters = getAllFilters(guildId);
  for (const filter of filters) {
    if (!matchesFilter(filter, bounty)) continue;
    try {
      const user = await client.users.fetch(filter.user_id);
      const dmEmbed = new EmbedBuilder()
        .setColor(0x6366f1)
        .setTitle(`🔔 Bounty Matches Your Filter: ${bounty.title}`)
        .addFields(
          { name: 'Tier', value: tierLabel(bounty.tier), inline: true },
          { name: 'Reward', value: formatReward(bounty.reward_amount), inline: true },
          { name: 'Category', value: bounty.category ?? 'General', inline: true },
        )
        .setTimestamp()
        .setFooter({ text: 'Use /clearfilter to stop these notifications' });
      await user.send({ embeds: [dmEmbed] });
    } catch {
      // User may have DMs disabled; skip silently
    }
  }
}

async function poll(client: Client): Promise<void> {
  try {
    const bounties = await fetchBounties({ status: 'open' });
    const newBounties = bounties.filter((b) => !knownBountyIds.has(b.id));

    for (const bounty of newBounties) {
      // Skip on first poll — don't spam on startup
      if (!isFirstPoll) {
        await postBountyEmbed(client, bounty);
        // Notify users with matching filters (use first guild)
        const guild = client.guilds.cache.first();
        if (guild) await notifyFilteredUsers(client, bounty, guild.id);
      }
      knownBountyIds.add(bounty.id);
    }

    if (isFirstPoll) isFirstPoll = false;
  } catch (err) {
    console.error('Poll error:', err);
  }
}

export function bountyCreatedHandler(client: Client): void {
  initDB();

  // Initial poll
  client.once('ready', () => {
    poll(client);
    // Set up interval
    setInterval(() => poll(client), POLL_INTERVAL_MS);
  });
}