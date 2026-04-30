/**
 * Main Discord bot class for SolFoundry.
 *
 * Initializes the Discord.js client, registers slash commands,
 * handles interactions, and starts the bounty monitoring services.
 *
 * @module bot
 */

import {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  TextChannel,
  Events,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
} from 'discord.js';
import type { BotConfig } from './config.js';
import { createLogger, type Logger } from './utils/logger.js';
import { SolFoundryApiClient } from './services/api-client.js';
import { BountyPoster } from './services/bounty-poster.js';
import { StatusUpdater } from './services/status-updater.js';
import { commands, routeCommand, routeButton } from './commands/index.js';

/**
 * Main SolFoundry Discord Bot.
 *
 * Manages the Discord client connection, command registration,
 * interaction handling, and background services.
 */
export class SolFoundryBot {
  private readonly config: BotConfig;
  private readonly logger: Logger;
  private client: Client | null;
  private apiClient: SolFoundryApiClient | null;
  private bountyPoster: BountyPoster | null;
  private statusUpdater: StatusUpdater | null;

  /**
   * Create a new SolFoundryBot.
   *
   * @param config - Bot configuration.
   */
  constructor(config: BotConfig) {
    this.config = config;
    this.logger = createLogger(config.logLevel);
    this.client = null;
    this.apiClient = null;
    this.bountyPoster = null;
    this.statusUpdater = null;
  }

  /**
   * Start the bot and all services.
   */
  async start(): Promise<void> {
    this.logger.info('Starting SolFoundry Discord Bot...');

    // Initialize API client
    this.apiClient = new SolFoundryApiClient({
      baseUrl: this.config.solFoundryApiUrl,
      token: this.config.solFoundryApiToken ?? undefined,
      logger: this.logger,
    });

    // Initialize Discord client
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.Channel],
    });

    // Set up event handlers
    this.setupEventHandlers();

    // Login to Discord
    await this.client.login(this.config.token);
    this.logger.info('Discord client logged in');

    // Register slash commands
    await this.registerCommands();

    // Initialize and start services
    await this.startServices();

    this.logger.info('SolFoundry Discord Bot is running!');
  }

  /**
   * Stop the bot and all services gracefully.
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping SolFoundry Discord Bot...');

    if (this.bountyPoster) {
      await this.bountyPoster.stop();
    }
    if (this.statusUpdater) {
      await this.statusUpdater.stop();
    }
    if (this.client) {
      this.client.destroy();
    }

    this.logger.info('SolFoundry Discord Bot stopped');
  }

  /**
   * Set up Discord client event handlers.
   */
  private setupEventHandlers(): void {
    if (!this.client) return;

    this.client.once(Events.ClientReady, (readyUser) => {
      this.logger.info(`Ready! Logged in as ${readyUser.tag}`);
    });

    this.client.on(Events.InteractionCreate, async (interaction) => {
      try {
        if (!this.apiClient) {
          this.logger.error('API client not initialized');
          return;
        }

        if (interaction.isChatInputCommand()) {
          await routeCommand(
            interaction as ChatInputCommandInteraction,
            this.apiClient,
            this.logger,
          );
        } else if (interaction.isButton()) {
          await routeButton(interaction as ButtonInteraction, this.logger);
        }
      } catch (error) {
        this.logger.error('Error handling interaction', error);
        const errorMessage = {
          content: 'An error occurred while processing your request.',
          ephemeral: true,
        };
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply(errorMessage).catch(() => {});
        }
      }
    });

    this.client.on(Events.Error, (error) => {
      this.logger.error('Discord client error', error);
    });

    this.client.on(Events.Warn, (warning) => {
      this.logger.warn(`Discord warning: ${warning}`);
    });
  }

  /**
   * Register slash commands with Discord.
   */
  private async registerCommands(): Promise<void> {
    if (!this.client || !this.client.application) {
      this.logger.error('Client application not ready');
      return;
    }

    const rest = new REST({ version: '10' }).setToken(this.config.token);

    try {
      this.logger.info(`Started registering ${commands.length} application commands.`);

      if (this.config.guildId) {
        // Register as guild commands (faster for development)
        await rest.put(
          Routes.applicationGuildCommands(this.config.clientId, this.config.guildId),
          { body: commands },
        );
        this.logger.info(`Registered ${commands.length} guild commands for ${this.config.guildId}`);
      } else {
        // Register as global commands
        await rest.put(Routes.applicationCommands(this.config.clientId), { body: commands });
        this.logger.info(`Registered ${commands.length} global commands`);
      }
    } catch (error) {
      this.logger.error('Failed to register commands', error);
      throw error;
    }
  }

  /**
   * Initialize and start background services.
   */
  private async startServices(): Promise<void> {
    if (!this.client || !this.apiClient) {
      this.logger.error('Client not initialized');
      return;
    }

    // Helper to get the bounty channel
    const getBountyChannel = async (): Promise<TextChannel | null> => {
      try {
        const channel = await this.client!.channels.fetch(this.config.bountyChannelId);
        if (channel instanceof TextChannel) {
          return channel;
        }
        this.logger.error(`Bounty channel ${this.config.bountyChannelId} is not a text channel`);
        return null;
      } catch (error) {
        this.logger.error(`Failed to fetch bounty channel: ${this.config.bountyChannelId}`, error);
        return null;
      }
    };

    // Start bounty poster
    this.bountyPoster = new BountyPoster(
      this.config,
      this.apiClient,
      this.logger,
    );
    await this.bountyPoster.start(getBountyChannel);

    // Start status updater
    this.statusUpdater = new StatusUpdater(
      this.apiClient,
      this.logger,
    );
    await this.statusUpdater.start(getBountyChannel);
  }
}
