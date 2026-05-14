/**
 * SolFoundry Discord Bot
 *
 * Commands:
 *   /bounties     — List current open bounties
 *   /leaderboard  — Show top contributors
 *   /notify       — Configure personal notification filters
 *   /bounty <id>  — View a specific bounty
 *
 * Automatically polls for new bounties and posts rich embeds
 * to the configured channel.
 */

import {
  Client,
  GatewayIntentBits,
  Events,
  SlashCommandBuilder,
  REST,
  Routes,
  ChatInputCommandInteraction,
} from 'discord.js';
import * as cron from 'node-cron';
import { validateEnv, env } from './config';
import { fetchLatestBounties, fetchOpenBounties, fetchLeaderboard } from './api';
import { bountyEmbed, leaderboardEmbed, bountyButtons } from './embeds';
import { getFilter, setFilter, matchesFilter } from './filters';

/* ─── Slash commands ─── */

const commands = [
  new SlashCommandBuilder()
    .setName('bounties')
    .setDescription('List current open bounties')
    .addIntegerOption(opt =>
      opt.setName('limit').setDescription('Number of bounties (1-10)').setMinValue(1).setMaxValue(10),
    ),

  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show top SolFoundry contributors'),

  new SlashCommandBuilder()
    .setName('bounty')
    .setDescription('View a specific bounty')
    .addStringOption(opt =>
      opt.setName('id').setDescription('Bounty ID').setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName('notify')
    .setDescription('Configure your bounty notification preferences')
    .addBooleanOption(opt =>
      opt.setName('enabled').setDescription('Enable or disable notifications'),
    )
    .addIntegerOption(opt =>
      opt.setName('min-reward').setDescription('Minimum reward amount in FNDRY').setMinValue(0),
    )
    .addStringOption(opt =>
      opt.setName('tiers').setDescription('Comma-separated tiers (t1,t2,t3)'),
    )
    .addStringOption(opt =>
      opt.setName('skills').setDescription('Comma-separated skill tags'),
    ),
].map(cmd => cmd.toJSON());

/* ─── Bot ─── */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

let lastPollTimestamp = new Date().toISOString();

/* ─── Register commands ─── */

async function registerCommands(): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);

  if (env.GUILD_ID) {
    await rest.put(
      Routes.applicationGuildCommands(client.user!.id, env.GUILD_ID),
      { body: commands },
    );
    console.log(`Registered ${commands.length} guild commands`);
  } else {
    await rest.put(
      Routes.applicationCommands(client.user!.id),
      { body: commands },
    );
    console.log(`Registered ${commands.length} global commands`);
  }
}

/* ─── Command handlers ─── */

async function handleBounties(interaction: ChatInputCommandInteraction): Promise<void> {
  const limit = interaction.options.getInteger('limit') ?? 5;

  await interaction.deferReply();

  try {
    const bounties = await fetchOpenBounties(limit);

    if (bounties.length === 0) {
      await interaction.editReply('No open bounties right now. Check back soon!');
      return;
    }

    for (const bounty of bounties.slice(0, 5)) {
      await interaction.followUp({
        embeds: [bountyEmbed(bounty)],
        components: [bountyButtons(bounty)],
      });
    }

    if (bounties.length > 5) {
      await interaction.followUp(`...and ${bounties.length - 5} more. Visit SolFoundry for the full list.`);
    }
  } catch (err) {
    console.error('Error fetching bounties:', err);
    await interaction.editReply('Failed to fetch bounties. Try again later.');
  }
}

async function handleLeaderboard(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  try {
    const entries = await fetchLeaderboard(env.LEADERBOARD_LIMIT);
    if (entries.length === 0) {
      await interaction.editReply('No leaderboard data yet.');
      return;
    }
    await interaction.editReply({ embeds: [leaderboardEmbed(entries)] });
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    await interaction.editReply('Failed to fetch leaderboard. Try again later.');
  }
}

async function handleBounty(interaction: ChatInputCommandInteraction): Promise<void> {
  const id = interaction.options.getString('id', true);
  await interaction.deferReply();

  try {
    // Fetch single bounty — use the API directly
    const res = await fetch(`${env.SOLFOUNDRY_API_URL}/api/bounties/${id}`);
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    const bounty = (await res.json()) as import('./api').Bounty;

    await interaction.editReply({
      embeds: [bountyEmbed(bounty)],
      components: [bountyButtons(bounty)],
    });
  } catch (err) {
    console.error('Error fetching bounty:', err);
    await interaction.editReply(`Bounty #${id} not found or API error.`);
  }
}

async function handleNotify(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;

  const enabled = interaction.options.getBoolean('enabled');
  const minReward = interaction.options.getInteger('min-reward');
  const tiersStr = interaction.options.getString('tiers');
  const skillsStr = interaction.options.getString('skills');

  const update: Record<string, unknown> = {};
  if (enabled !== null) update.enabled = enabled;
  if (minReward !== null) update.minReward = minReward;
  if (tiersStr) update.tiers = tiersStr.split(',').map(t => t.trim());
  if (skillsStr) update.skills = skillsStr.split(',').map(s => s.trim());

  const filter = setFilter(guildId, userId, update);

  const lines = [
    `**Notification Preferences** for <@${userId}>`,
    `Enabled: ${filter.enabled ? '✅' : '❌'}`,
    `Min Reward: ${filter.minReward.toLocaleString()} $FNDRY`,
    `Tiers: ${filter.tiers.length ? filter.tiers.join(', ') : 'any'}`,
    `Skills: ${filter.skills.length ? filter.skills.join(', ') : 'any'}`,
  ];

  await interaction.reply({ content: lines.join('\n'), ephemeral: true });
}

/* ─── Polling ─── */

async function pollForNewBounties(): Promise<void> {
  try {
    const newBounties = await fetchLatestBounties(lastPollTimestamp);
    lastPollTimestamp = new Date().toISOString();

    if (newBounties.length === 0) return;

    const channel = await client.channels.fetch(env.BOUNTY_CHANNEL_ID);
    if (!channel?.isTextBased()) return;

    for (const bounty of newBounties) {
      // Send to the main channel
      if ('send' in channel) {
        await (channel as any).send({
          embeds: [bountyEmbed(bounty)],
          components: [bountyButtons(bounty)],
        });
      }

      // Send DMs to users whose filters match
      // (only in guilds where we have member lists)
      for (const [guildId, guild] of client.guilds.cache) {
        const members = await guild.members.fetch();
        for (const [memberId, member] of members) {
          if (member.user.bot) continue;
          const filter = getFilter(guild.id, member.id);
          if (matchesFilter(bounty, filter)) {
            try {
              await member.send({
                embeds: [bountyEmbed(bounty)],
                components: [bountyButtons(bounty)],
              });
            } catch {
              // User has DMs disabled — skip silently
            }
          }
        }
      }
    }

    console.log(`Posted ${newBounties.length} new bounties`);
  } catch (err) {
    console.error('Polling error:', err);
  }
}

/* ─── Lifecycle ─── */

client.once(Events.ClientReady, async () => {
  console.log(`SolFoundry bot online as ${client.user!.tag}`);
  await registerCommands();

  // Poll every POLL_INTERVAL_SEC seconds
  setInterval(pollForNewBounties, env.POLL_INTERVAL_SEC * 1000);

  // Also poll on a cron schedule (every minute) for redundancy
  cron.schedule('* * * * *', pollForNewBounties);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  switch (interaction.commandName) {
    case 'bounties':
      await handleBounties(interaction);
      break;
    case 'leaderboard':
      await handleLeaderboard(interaction);
      break;
    case 'bounty':
      await handleBounty(interaction);
      break;
    case 'notify':
      await handleNotify(interaction);
      break;
  }
});

/* ─── Start ─── */

validateEnv();
client.login(env.DISCORD_TOKEN);
