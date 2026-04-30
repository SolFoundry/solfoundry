/**
 * Configuration management for the SolFoundry Discord Bot.
 *
 * Loads environment variables with validation and provides
 * strongly-typed access to all configuration values.
 *
 * @module config
 */

/** Log levels supported by the bot logger. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Environment modes for the bot. */
export type Environment = 'development' | 'production';

/**
 * Bot configuration loaded from environment variables.
 * All values are validated at construction time.
 */
export interface BotConfig {
  /** Discord bot token for authentication. */
  readonly token: string;
  /** Discord application/client ID for command registration. */
  readonly clientId: string;
  /** Optional guild ID for guild-scoped commands. */
  readonly guildId: string | null;
  /** Channel ID for bounty notifications. */
  readonly bountyChannelId: string;
  /** Optional channel ID for general announcements. */
  readonly announcementsChannelId: string | null;
  /** Optional channel ID for periodic leaderboard posts. */
  readonly leaderboardChannelId: string | null;
  /** SolFoundry API base URL. */
  readonly solFoundryApiUrl: string;
  /** SolFoundry API authentication token. */
  readonly solFoundryApiToken: string | null;
  /** Polling interval for new bounties in seconds. */
  readonly bountyPollInterval: number;
  /** Logging verbosity level. */
  readonly logLevel: LogLevel;
  /** Runtime environment. */
  readonly environment: Environment;
}

/**
 * Required environment variable names for validation.
 */
const REQUIRED_VARS = ['DISCORD_BOT_TOKEN', 'DISCORD_CLIENT_ID', 'BOUNTY_CHANNEL_ID'] as const;

/**
 * Validate that all required environment variables are present.
 *
 * @param env - The environment object to validate (defaults to process.env).
 * @throws Error if any required variable is missing.
 */
function validateRequired(env: NodeJS.ProcessEnv): void {
  const missing = REQUIRED_VARS.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        `Copy .env.example to .env and fill in the values.`,
    );
  }
}

/**
 * Parse and validate a numeric environment variable.
 *
 * @param env - The environment object.
 * @param key - The variable name.
 * @param defaultValue - Default value if not set or invalid.
 * @returns The parsed numeric value.
 */
function parseNumber(env: NodeJS.ProcessEnv, key: string, defaultValue: number): number {
  const raw = env[key];
  if (!raw) return defaultValue;
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed <= 0) {
    console.warn(`Invalid value for ${key}: "${raw}", using default: ${defaultValue}`);
    return defaultValue;
  }
  return parsed;
}

/**
 * Parse and validate an enum-like environment variable.
 *
 * @param env - The environment object.
 * @param key - The variable name.
 * @param validValues - Allowed values.
 * @param defaultValue - Default if not set or invalid.
 * @returns The validated value.
 */
function parseEnum<T extends string>(
  env: NodeJS.ProcessEnv,
  key: string,
  validValues: readonly T[],
  defaultValue: T,
): T {
  const raw = env[key];
  if (!raw) return defaultValue;
  if (!validValues.includes(raw as T)) {
    console.warn(
      `Invalid value for ${key}: "${raw}", expected one of ${validValues.join(', ')}, using default: ${defaultValue}`,
    );
    return defaultValue;
  }
  return raw as T;
}

/**
 * Load and validate bot configuration from environment variables.
 *
 * @param env - The environment object (defaults to process.env).
 * @returns Validated bot configuration.
 * @throws Error if required variables are missing.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): BotConfig {
  validateRequired(env);

  return {
    token: env.DISCORD_BOT_TOKEN!,
    clientId: env.DISCORD_CLIENT_ID!,
    guildId: env.DISCORD_GUILD_ID || null,
    bountyChannelId: env.BOUNTY_CHANNEL_ID!,
    announcementsChannelId: env.ANNOUNCEMENTS_CHANNEL_ID || null,
    leaderboardChannelId: env.LEADERBOARD_CHANNEL_ID || null,
    solFoundryApiUrl: env.SOLFOUNDRY_API_URL || 'https://api.solfoundry.io',
    solFoundryApiToken: env.SOLFOUNDRY_API_TOKEN || null,
    bountyPollInterval: parseNumber(env, 'BOUNTY_POLL_INTERVAL', 60),
    logLevel: parseEnum(env, 'LOG_LEVEL', ['debug', 'info', 'warn', 'error'] as const, 'info'),
    environment: parseEnum(env, 'NODE_ENV', ['development', 'production'] as const, 'development'),
  };
}
