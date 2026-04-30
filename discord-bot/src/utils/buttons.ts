/**
 * Interactive button builders for SolFoundry bounty posts.
 *
 * Creates action buttons for bounty embeds: View Details, Claim, Subscribe.
 * Uses Discord.js v14 ButtonBuilder and ActionRowBuilder.
 *
 * @module buttons
 */

import { ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';

/** Available action types for bounty buttons. */
export type BountyAction = 'view_details' | 'claim' | 'subscribe';

/**
 * Configuration for creating bounty action buttons.
 */
export interface BountyButtonConfig {
  /** Unique bounty identifier. */
  bountyId: string;
  /** GitHub issue URL for the bounty. */
  githubIssueUrl: string | null;
  /** Whether the bounty is claimable (T2/T3). */
  isClaimable: boolean;
  /** Custom ID prefix for interaction tracking. */
  customIdPrefix?: string;
}

/**
 * Create an action row with bounty interaction buttons.
 *
 * Always includes: View Details (link button)
 * Conditionally includes: Claim (custom button, for T2/T3)
 * Always includes: Subscribe (custom button)
 *
 * @param config - Button configuration.
 * @returns An ActionRowBuilder containing the buttons.
 */
export function createBountyButtons(config: BountyButtonConfig): ActionRowBuilder {
  const prefix = config.customIdPrefix || 'sf';
  const buttons: ButtonBuilder[] = [];

  // View Details button (always present, link button)
  if (config.githubIssueUrl) {
    buttons.push(
      new ButtonBuilder()
        .setLabel('🔗 View Details')
        .setStyle(ButtonStyle.Link)
        .setURL(config.githubIssueUrl),
    );
  } else {
    // Fallback to web view if no GitHub URL
    buttons.push(
      new ButtonBuilder()
        .setLabel('🔗 View Details')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://solfoundry.org/bounties/${config.bountyId}`),
    );
  }

  // Claim button (only for claimable bounties - T2/T3)
  if (config.isClaimable) {
    buttons.push(
      new ButtonBuilder()
        .setLabel('🎯 Claim')
        .setStyle(ButtonStyle.Primary)
        .setCustomId(`${prefix}:claim:${config.bountyId}`),
    );
  }

  // Subscribe button (always present)
  buttons.push(
    new ButtonBuilder()
      .setLabel('🔔 Subscribe')
      .setStyle(ButtonStyle.Secondary)
      .setCustomId(`${prefix}:subscribe:${config.bountyId}`),
  );

  return new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons);
}

/**
 * Create an action row with status update action buttons.
 *
 * @param bountyId - The bounty identifier.
 * @param githubIssueUrl - Optional GitHub URL.
 * @returns An ActionRowBuilder with View Details and Subscribe buttons.
 */
export function createStatusUpdateButtons(
  bountyId: string,
  githubIssueUrl: string | null,
): ActionRowBuilder {
  const buttons: ButtonBuilder[] = [];

  if (githubIssueUrl) {
    buttons.push(
      new ButtonBuilder()
        .setLabel('🔗 View Details')
        .setStyle(ButtonStyle.Link)
        .setURL(githubIssueUrl),
    );
  }

  buttons.push(
    new ButtonBuilder()
      .setLabel('🔔 Subscribe')
      .setStyle(ButtonStyle.Secondary)
      .setCustomId(`sf:subscribe:${bountyId}`),
  );

  return new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons);
}

/**
 * Parse a button custom ID to extract action and bounty ID.
 *
 * @param customId - The Discord button custom ID.
 * @returns Parsed action and bounty ID, or null if invalid.
 */
export function parseButtonCustomId(
  customId: string,
): { action: BountyAction; bountyId: string } | null {
  const prefix = 'sf';
  if (!customId.startsWith(`${prefix}:`)) return null;

  const parts = customId.split(':');
  if (parts.length !== 3) return null;

  const [, action, bountyId] = parts;

  const validActions: BountyAction[] = ['view_details', 'claim', 'subscribe'];
  if (!validActions.includes(action as BountyAction)) return null;

  return { action: action as BountyAction, bountyId };
}
