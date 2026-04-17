/**
 * SolFoundry Discord Bot — Entry Point
 *
 * Connects to Discord and the SolFoundry API, listens for new bounties
 * via WebSocket, and posts rich embeds to a configured channel.
 * Supports slash commands for leaderboard and notification filters.
 */

import 'dotenv/config';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { bountyCreatedHandler } from './events/bounty-created.js';
import { leaderboardCommand } from './commands/leaderboard.js';
import { filtersCommand } from './commands/filters.js';
import { setfilterCommand } from './commands/setfilter.js';
import { myfiltersCommand } from './commands/myfilters.js';
import { clearfilterCommand } from './commands/clearfilter.js';
import { registerCommands } from './register-commands.js';

const REQUIRED_ENV = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'BOUNTY_CHANNEL_ID'];

function validateEnv(): void {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`Missing required env vars: ${missing.join(', ')}`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  validateEnv();

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
    ],
    partials: [Partials.Channel],
  });

  // Register slash commands on ready
  client.once('ready', async () => {
    console.log(`Logged in as ${client.user?.tag}`);
    await registerCommands();
    console.log('Slash commands registered');
  });

  // Handle interactions (slash commands)
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    try {
      switch (interaction.commandName) {
        case 'leaderboard':
          await leaderboardCommand(interaction);
          break;
        case 'setfilter':
          await setfilterCommand(interaction);
          break;
        case 'myfilters':
          await myfiltersCommand(interaction);
          break;
        case 'clearfilter':
          await clearfilterCommand(interaction);
          break;
        case 'filters':
          await filtersCommand(interaction);
          break;
      }
    } catch (err) {
      console.error(`Error handling command ${interaction.commandName}:`, err);
      const reply = { content: '❌ An error occurred while processing your command.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    }
  });

  // Start polling for new bounties
  bountyCreatedHandler(client);

  await client.login(process.env.DISCORD_TOKEN!);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

export { main };