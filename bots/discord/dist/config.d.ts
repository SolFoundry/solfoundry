/**
 * SolFoundry Discord Bot — Environment Configuration
 */
export declare const env: {
    /** Discord bot token (from Discord Developer Portal). */
    readonly DISCORD_TOKEN: string;
    /** Guild ID for server-specific commands (optional, uses global if empty). */
    readonly GUILD_ID: string;
    /** Channel ID to post new bounty notifications. */
    readonly BOUNTY_CHANNEL_ID: string;
    /** SolFoundry API base URL. */
    readonly SOLFOUNDRY_API_URL: string;
    /** Polling interval in seconds for new bounties. */
    readonly POLL_INTERVAL_SEC: number;
    /** Max leaderboard entries to display. */
    readonly LEADERBOARD_LIMIT: number;
};
export declare function validateEnv(): void;
