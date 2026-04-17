/**
 * Register slash commands with Discord's API.
 *
 * Uses REST API directly for clean command registration.
 * Can be run standalone or as part of bot startup.
 */

import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const commands = [
  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View top SolFoundry contributors by completed bounties')
    .addIntegerOption((opt) =>
      opt.setName('limit').setDescription('Number of entries (1-25)').setMinValue(1).setMaxValue(25).setRequired(false),
    ),

  new SlashCommandBuilder()
    .setName('filters')
    .setDescription('View available bounty categories and tier levels for filtering'),

  new SlashCommandBuilder()
    .setName('setfilter')
    .setDescription('Set notification filters for bounty alerts')
    .addStringOption((opt) =>
      opt
        .setName('category')
        .setDescription('Filter by bounty category (e.g., backend, frontend, smart-contract)')
        .setRequired(false),
    )
    .addIntegerOption((opt) =>
      opt
        .setName('min_tier')
        .setDescription('Minimum tier (1=T1, 2=T2, 3=T3)')
        .setMinValue(1)
        .setMaxValue(3)
        .setRequired(false),
    )
    .addIntegerOption((opt) =>
      opt
        .setName('max_tier')
        .setDescription('Maximum tier (1=T1, 2=T2, 3=T3)')
        .setMinValue(1)
        .setMaxValue(3)
        .setRequired(false),
    )
    .addIntegerOption((opt) =>
      opt
        .setName('min_reward')
        .setDescription('Minimum reward amount in $FNDRY')
        .setMinValue(0)
        .setRequired(false),
    ),

  new SlashCommandBuilder()
    .setName('myfilters')
    .setDescription('View your current notification filter settings'),

  new SlashCommandBuilder()
    .setName('clearfilter')
    .setDescription('Clear all your notification filters'),
].map((cmd) => cmd.toJSON());

export async function registerCommands(): Promise<void> {
  const token = process.env.DISCORD_TOKEN!;
  const clientId = process.env.DISCORD_CLIENT_ID!;
  const guildId = process.env.DISCORD_GUILD_ID;

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    if (guildId) {
      // Guild-specific (instant, for dev)
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
      console.log(`Registered ${commands.length} guild commands`);
    } else {
      // Global (takes up to 1h to propagate)
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log(`Registered ${commands.length} global commands`);
    }
  } catch (err) {
    console.error('Failed to register commands:', err);
    throw err;
  }
}

// Allow standalone execution
if (process.argv[1]?.endsWith('register-commands.ts') || process.argv[1]?.endsWith('register-commands.js')) {
  registerCommands()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}