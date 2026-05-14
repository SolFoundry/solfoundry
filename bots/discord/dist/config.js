"use strict";
/**
 * SolFoundry Discord Bot — Environment Configuration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
exports.validateEnv = validateEnv;
exports.env = {
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
};
function validateEnv() {
    if (!exports.env.DISCORD_TOKEN)
        throw new Error('DISCORD_TOKEN is required');
    if (!exports.env.BOUNTY_CHANNEL_ID)
        throw new Error('BOUNTY_CHANNEL_ID is required');
}
//# sourceMappingURL=config.js.map