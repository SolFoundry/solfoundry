/**
 * Bounty posting service for the Discord bot.
 *
 * Monitors the SolFoundry API for new bounties and posts them
 * to the configured Discord channel with rich embeds and buttons.
 * Includes deduplication to prevent duplicate posts.
 *
 * @module bounty-poster
 */

import type { TextChannel, Message } from 'discord.js';
import type { BotConfig } from '../config.js';
import type { Logger } from '../utils/logger.js';
import type { SolFoundryApiClient, ApiBounty } from './api-client.js';
import { createBountyEmbed, type BountyData } from '../utils/embeds.js';
import { createBountyButtons } from '../utils/buttons.js';

/**
 * Service for posting new bounties to Discord.
 *
 * Polls the SolFoundry API at configured intervals and posts
 * new bounties to the designated channel.
 */
export class BountyPoster {
  private readonly config: BotConfig;
  private readonly apiClient: SolFoundryApiClient;
  private readonly logger: Logger;
  private readonly postedBountyIds: Set<string>;
  private pollInterval: ReturnType<typeof setInterval> | null;
  private isRunning: boolean;

  /**
   * Create a new BountyPoster.
   *
   * @param config - Bot configuration.
   * @param apiClient - SolFoundry API client.
   * @param logger - Logger instance.
   */
  constructor(config: BotConfig, apiClient: SolFoundryApiClient, logger: Logger) {
    this.config = config;
    this.apiClient = apiClient;
    this.logger = logger.child('BountyPoster');
    this.postedBountyIds = new Set();
    this.pollInterval = null;
    this.isRunning = false;
  }

  /**
   * Start the bounty polling loop.
   *
   * @param getChannel - Async function to retrieve the target Discord channel.
   */
  async start(
    getChannel: () => Promise<TextChannel | null>,
  ): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Bounty poster is already running');
      return;
    }

    this.isRunning = true;
    this.logger.info(
      `Starting bounty poster (poll interval: ${this.config.bountyPollInterval}s)`,
    );

    // Initial scan
    await this.scanForNewBounties(getChannel);

    // Set up periodic polling
    this.pollInterval = setInterval(
      () => this.scanForNewBounties(getChannel),
      this.config.bountyPollInterval * 1000,
    );
  }

  /**
   * Stop the bounty polling loop.
   */
  async stop(): Promise<void> {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isRunning = false;
    this.logger.info('Bounty poster stopped');
  }

  /**
   * Check for new bounties and post them to Discord.
   *
   * @param getChannel - Async function to retrieve the target Discord channel.
   */
  private async scanForNewBounties(
    getChannel: () => Promise<TextChannel | null>,
  ): Promise<void> {
    try {
      const bounties = await this.apiClient.fetchOpenBounties();
      const newBounties = bounties.filter((b) => !this.postedBountyIds.has(b.id));

      if (newBounties.length === 0) {
        this.logger.debug('No new bounties found');
        return;
      }

      this.logger.info(`Found ${newBounties.length} new bounties`);

      const channel = await getChannel();
      if (!channel) {
        this.logger.error('Could not retrieve bounty channel');
        return;
      }

      for (const bounty of newBounties) {
        await this.postBounty(channel, bounty);
        this.postedBountyIds.add(bounty.id);
      }
    } catch (error) {
      this.logger.error('Error scanning for new bounties', error);
    }
  }

  /**
   * Post a single bounty to a Discord channel.
   *
   * @param channel - The Discord text channel.
   * @param bounty - The bounty data from the API.
   */
  private async postBounty(channel: TextChannel, bounty: ApiBounty): Promise<Message | void> {
    try {
      const bountyData: BountyData = {
        id: bounty.id,
        title: bounty.title,
        description: bounty.description,
        tier: bounty.tier,
        category: bounty.category,
        rewardAmount: bounty.reward_amount,
        status: bounty.status,
        deadline: bounty.deadline,
        githubIssueUrl: bounty.github_issue_url,
        requiredSkills: bounty.required_skills,
        createdAt: bounty.created_at,
      };

      const embed = createBountyEmbed(bountyData);
      const isClaimable = bounty.tier >= 2;
      const components = [
        createBountyButtons({
          bountyId: bounty.id,
          githubIssueUrl: bounty.github_issue_url,
          isClaimable,
        }),
      ];

      const message = await channel.send({
        content: `🆕 **New Bounty Alert!**`,
        embeds: [embed],
        components,
      });

      this.logger.info(`Posted bounty: ${bounty.title} (${bounty.id})`);
      return message;
    } catch (error) {
      this.logger.error(`Failed to post bounty: ${bounty.title}`, error);
    }
  }

  /**
   * Check if a bounty has already been posted.
   *
   * @param bountyId - The bounty ID to check.
   * @returns True if the bounty has been posted.
   */
  isPosted(bountyId: string): boolean {
    return this.postedBountyIds.has(bountyId);
  }
}
