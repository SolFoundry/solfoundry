/**
 * SolFoundry Discord Bot — Environment Configuration
 */

export const env = {
  /** Discord bot token (from Discord Developer Portal). */
  DISCORD_TOKEN: process.env.DISCORD_TOKEN ?? '',
  /** Guild ID for server-specific commands (optional, uses global if empty). */
  GUILD_ID: process.env.GUILD_ID ?? '',
  /** Channel ID to post new bounty notifications. */
  BOUNTY_CHANNEL_ID: process.env.BOUNTY_CHANNEL_ID ?? '',
  /** SolFoundry API base URL. */
  SOLFOUNDRY_API_URL: process.env.SOLFOUNDRY_API_URL ?? 'https://solfoundry.xyz',
  /** Polling interval in seconds for new bounties. */
  POLL_INTERVAL_SEC: parseInt(process.env.POLL_INTERVAL_SEC ?? '60', 10),
  /** Max leaderboard entries to display. */
  LEADERBOARD_LIMIT: parseInt(process.env.LEADERBOARD_LIMIT ?? '10', 10),
} as const;

export function validateEnv(): void {
  if (!env.DISCORD_TOKEN) throw new Error('DISCORD_TOKEN is required');
  if (!env.BOUNTY_CHANNEL_ID) throw new Error('BOUNTY_CHANNEL_ID is required');
}
