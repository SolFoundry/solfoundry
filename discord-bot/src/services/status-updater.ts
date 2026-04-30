/**
 * Bounty status update service for the Discord bot.
 *
 * Monitors bounty status changes and posts update notifications
 * to Discord channels when bounties transition between states.
 *
 * @module status-updater
 */

import type { TextChannel } from 'discord.js';
import type { Logger } from '../utils/logger.js';
import type { SolFoundryApiClient, ApiBounty } from './api-client.js';
import { createStatusUpdateEmbed, type StatusUpdateData } from '../utils/embeds.js';
import { createStatusUpdateButtons } from '../utils/buttons.js';

/**
 * Tracks the last known status of each bounty to detect changes.
 */
interface BountyState {
  status: string;
  title: string;
  githubIssueUrl: string | null;
}

/**
 * Service for monitoring and notifying bounty status changes.
 */
export class StatusUpdater {
  private readonly apiClient: SolFoundryApiClient;
  private readonly logger: Logger;
  private readonly knownStates: Map<string, BountyState>;
  private pollInterval: ReturnType<typeof setInterval> | null;
  private isRunning: boolean;

  /**
   * Create a new StatusUpdater.
   *
   * @param apiClient - SolFoundry API client.
   * @param logger - Logger instance.
   */
  constructor(apiClient: SolFoundryApiClient, logger: Logger) {
    this.apiClient = apiClient;
    this.logger = logger.child('StatusUpdater');
    this.knownStates = new Map();
    this.pollInterval = null;
    this.isRunning = false;
  }

  /**
   * Start the status monitoring loop.
   *
   * @param getChannel - Async function to retrieve the target Discord channel.
   * @param pollIntervalMs - Polling interval in milliseconds.
   */
  async start(
    getChannel: () => Promise<TextChannel | null>,
    pollIntervalMs: number = 120000,
  ): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Status updater is already running');
      return;
    }

    this.isRunning = true;
    this.logger.info('Starting status updater');

    // Initial state capture
    await this.captureInitialState();

    // Set up periodic polling
    this.pollInterval = setInterval(
      () => this.checkForStatusChanges(getChannel),
      pollIntervalMs,
    );
  }

  /**
   * Stop the status monitoring loop.
   */
  async stop(): Promise<void> {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isRunning = false;
    this.logger.info('Status updater stopped');
  }

  /**
   * Capture the initial state of all known bounties.
   */
  private async captureInitialState(): Promise<void> {
    try {
      const bounties = await this.apiClient.fetchOpenBounties();
      for (const bounty of bounties) {
        this.knownStates.set(bounty.id, {
          status: bounty.status,
          title: bounty.title,
          githubIssueUrl: bounty.github_issue_url,
        });
      }
      this.logger.debug(`Captured initial state for ${bounties.length} bounties`);
    } catch (error) {
      this.logger.error('Failed to capture initial bounty states', error);
    }
  }

  /**
   * Check for status changes and post notifications.
   *
   * @param getChannel - Async function to retrieve the target Discord channel.
   */
  private async checkForStatusChanges(
    getChannel: () => Promise<TextChannel | null>,
  ): Promise<void> {
    try {
      const bounties = await this.apiClient.fetchOpenBounties();
      const channel = await getChannel();

      if (!channel) {
        this.logger.error('Could not retrieve bounty channel');
        return;
      }

      for (const bounty of bounties) {
        const knownState = this.knownStates.get(bounty.id);

        if (knownState && knownState.status !== bounty.status) {
          // Status changed!
          this.logger.info(
            `Status change: ${bounty.title} (${bounty.id}): ${knownState.status} → ${bounty.status}`,
          );

          const updateData: StatusUpdateData = {
            bountyId: bounty.id,
            title: bounty.title,
            oldStatus: knownState.status,
            newStatus: bounty.status,
            githubIssueUrl: bounty.github_issue_url,
          };

          const embed = createStatusUpdateEmbed(updateData);
          const components = [
            createStatusUpdateButtons(bounty.id, bounty.github_issue_url),
          ];

          await channel.send({
            embeds: [embed],
            components,
          });

          // Update known state
          this.knownStates.set(bounty.id, {
            status: bounty.status,
            title: bounty.title,
            githubIssueUrl: bounty.github_issue_url,
          });
        } else if (!knownState) {
          // New bounty, track it
          this.knownStates.set(bounty.id, {
            status: bounty.status,
            title: bounty.title,
            githubIssueUrl: bounty.github_issue_url,
          });
        }
      }
    } catch (error) {
      this.logger.error('Error checking status changes', error);
    }
  }

  /**
   * Manually trigger a status check (for testing).
   *
   * @param getChannel - Async function to retrieve the target Discord channel.
   */
  async forceCheck(
    getChannel: () => Promise<TextChannel | null>,
  ): Promise<void> {
    await this.checkForStatusChanges(getChannel);
  }
}
