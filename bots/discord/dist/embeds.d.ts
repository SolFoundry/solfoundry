/**
 * Discord embed builders for SolFoundry bounty and leaderboard displays.
 */
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder } from 'discord.js';
import type { Bounty, LeaderboardEntry } from './api';
export declare function bountyEmbed(bounty: Bounty): EmbedBuilder;
export declare function leaderboardEmbed(entries: LeaderboardEntry[]): EmbedBuilder;
export declare function bountyButtons(bounty: Bounty): ActionRowBuilder<ButtonBuilder>;
