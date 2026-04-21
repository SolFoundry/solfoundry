/**
 * SolFoundry Discord Bot — Bounty notifications, leaderboard, and filters.
 *
 * Posts new bounties to a channel, displays live leaderboard rankings,
 * and allows users to filter notifications by bounty type and reward level.
 *
 * @module discord-bot
 */

import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  REST,
  Routes,
  Interaction,
  TextChannel,
  ActivityType,
  Partials,
} from 'discord.js';
import { BountyPoller } from './services/bounty-poller.js';
import { CommandHandler } from './commands/index.js';
import { resolveTierColor, formatReward } from './utils/format.js';

export interface BotConfig {
  token: string;
  apiBaseUrl: string;
  channelId: string;
  guildId: string;
  pollIntervalMs?: number;
  clientId?: string;
}

export class SolFoundryBot {
  public readonly client: Client;
  private readonly config: BotConfig;
  private readonly poller: BountyPoller;
  private readonly commandHandler: CommandHandler;

  constructor(config: BotConfig) {
    this.config = config;
    this.poller = new BountyPoller({
      apiBaseUrl: config.apiBaseUrl,
      pollIntervalMs: config.pollIntervalMs ?? 300_000,
    });

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.Channel],
    });

    this.commandHandler = new CommandHandler(this.client, this.poller);
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.once('ready', async () => {
      console.log(`✅ SolFoundry Bot online as ${this.client.user?.tag}`);
      this.client.user?.setActivity({
        name: 'bounties on SolFoundry',
        type: ActivityType.Watching,
      });

      if (this.config.clientId && this.config.guildId) {
        await this.registerCommands();
      }

      this.poller.on('newBounty', async (bounty) => {
        const channel = this.client.channels.cache.get(this.config.channelId) as TextChannel;
        if (!channel) return;
        await this.postBountyEmbed(channel, bounty);
      });

      await this.poller.start();
    });

    this.client.on('interactionCreate', async (interaction: Interaction) => {
      if (!interaction.isChatInputCommand()) return;
      await this.commandHandler.handle(interaction);
    });
  }

  private async postBountyEmbed(channel: TextChannel, bounty: any): Promise<void> {
    const tierColor = resolveTierColor(bounty.tier);
    const embed = new EmbedBuilder()
      .setTitle(`🏭 ${bounty.title}`)
      .setURL(bounty.url ?? `https://solfoundry.org/bounties/${bounty.id}`)
      .setColor(tierColor)
      .addFields(
        { name: '💰 Reward', value: formatReward(bounty.reward_amount, bounty.currency ?? 'FNDRY'), inline: true },
        { name: '🏷️ Tier', value: `T${bounty.tier ?? 1}`, inline: true },
        { name: '📂 Domain', value: bounty.domain ?? 'General', inline: true },
        { name: '📋 Status', value: bounty.status ?? 'Open', inline: true },
        { name: '📝 Description', value: (bounty.description ?? '').slice(0, 300), inline: false },
      )
      .setFooter({ text: 'SolFoundry • AI Agent Bounty Marketplace' })
      .setTimestamp(new Date(bounty.created_at ?? Date.now()));

    await channel.send({ embeds: [embed] });
  }

  private async registerCommands(): Promise<void> {
    const commands = this.commandHandler.getCommandDefinitions();
    const rest = new REST({ version: '10' }).setToken(this.config.token);
    try {
      await rest.put(
        Routes.applicationGuildCommands(this.config.clientId!, this.config.guildId!),
        { body: commands },
      );
      console.log(`✅ Registered ${commands.length} slash commands`);
    } catch (err) {
      console.error('Failed to register commands:', err);
    }
  }

  async start(): Promise<void> {
    await this.client.login(this.config.token);
  }

  async stop(): Promise<void> {
    await this.poller.stop();
    this.client.destroy();
    console.log('🛑 Bot stopped');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const token = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_CHANNEL_ID;
  const guildId = process.env.DISCORD_GUILD_ID;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const apiBaseUrl = process.env.SOLFOUNDRY_API_URL ?? 'https://api.solfoundry.io';

  if (!token || !channelId) {
    console.error('Missing required env vars: DISCORD_BOT_TOKEN, DISCORD_CHANNEL_ID');
    process.exit(1);
  }

  const bot = new SolFoundryBot({ token, channelId, guildId: guildId ?? '', clientId: clientId ?? '', apiBaseUrl });
  bot.start().catch(console.error);
  process.on('SIGINT', () => bot.stop().then(() => process.exit(0)));
  process.on('SIGTERM', () => bot.stop().then(() => process.exit(0)));
}
