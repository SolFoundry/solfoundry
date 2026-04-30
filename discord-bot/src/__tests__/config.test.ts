/**
 * Tests for the configuration module.
 *
 * Validates environment variable loading, validation,
 * and default value handling.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { loadConfig } from '../config.js';

// ---------------------------------------------------------------------------
// Required Variable Validation
// ---------------------------------------------------------------------------

describe('loadConfig', () => {
  const baseEnv: NodeJS.ProcessEnv = {
    DISCORD_BOT_TOKEN: 'test-token-123',
    DISCORD_CLIENT_ID: 'client-456',
    BOUNTY_CHANNEL_ID: 'channel-789',
  };

  it('should throw when DISCORD_BOT_TOKEN is missing', () => {
    const env = { ...baseEnv };
    delete env.DISCORD_BOT_TOKEN;
    expect(() => loadConfig(env)).toThrow('DISCORD_BOT_TOKEN');
  });

  it('should throw when DISCORD_CLIENT_ID is missing', () => {
    const env = { ...baseEnv };
    delete env.DISCORD_CLIENT_ID;
    expect(() => loadConfig(env)).toThrow('DISCORD_CLIENT_ID');
  });

  it('should throw when BOUNTY_CHANNEL_ID is missing', () => {
    const env = { ...baseEnv };
    delete env.BOUNTY_CHANNEL_ID;
    expect(() => loadConfig(env)).toThrow('BOUNTY_CHANNEL_ID');
  });

  it('should throw when multiple required variables are missing', () => {
    expect(() => loadConfig({})).toThrow('DISCORD_BOT_TOKEN');
  });

  // ---------------------------------------------------------------------------
  // Valid Configuration
  // ---------------------------------------------------------------------------

  it('should load valid configuration', () => {
    const config = loadConfig(baseEnv);
    expect(config.token).toBe('test-token-123');
    expect(config.clientId).toBe('client-456');
    expect(config.bountyChannelId).toBe('channel-789');
  });

  it('should set guildId to null when not provided', () => {
    const config = loadConfig(baseEnv);
    expect(config.guildId).toBeNull();
  });

  it('should set guildId when provided', () => {
    const env = { ...baseEnv, DISCORD_GUILD_ID: 'guild-123' };
    const config = loadConfig(env);
    expect(config.guildId).toBe('guild-123');
  });

  // ---------------------------------------------------------------------------
  // Optional Variables with Defaults
  // ---------------------------------------------------------------------------

  it('should use default API URL when not provided', () => {
    const config = loadConfig(baseEnv);
    expect(config.solFoundryApiUrl).toBe('https://api.solfoundry.io');
  });

  it('should use custom API URL when provided', () => {
    const env = { ...baseEnv, SOLFOUNDRY_API_URL: 'https://custom.api' };
    const config = loadConfig(env);
    expect(config.solFoundryApiUrl).toBe('https://custom.api');
  });

  it('should set API token to null when not provided', () => {
    const config = loadConfig(baseEnv);
    expect(config.solFoundryApiToken).toBeNull();
  });

  it('should use custom API token when provided', () => {
    const env = { ...baseEnv, SOLFOUNDRY_API_TOKEN: 'secret-token' };
    const config = loadConfig(env);
    expect(config.solFoundryApiToken).toBe('secret-token');
  });

  // ---------------------------------------------------------------------------
  // Numeric Defaults
  // ---------------------------------------------------------------------------

  it('should use default poll interval of 60 seconds', () => {
    const config = loadConfig(baseEnv);
    expect(config.bountyPollInterval).toBe(60);
  });

  it('should use custom poll interval when valid', () => {
    const env = { ...baseEnv, BOUNTY_POLL_INTERVAL: '120' };
    const config = loadConfig(env);
    expect(config.bountyPollInterval).toBe(120);
  });

  it('should use default for invalid poll interval', () => {
    const env = { ...baseEnv, BOUNTY_POLL_INTERVAL: 'invalid' };
    const config = loadConfig(env);
    expect(config.bountyPollInterval).toBe(60);
  });

  it('should use default for negative poll interval', () => {
    const env = { ...baseEnv, BOUNTY_POLL_INTERVAL: '-10' };
    const config = loadConfig(env);
    expect(config.bountyPollInterval).toBe(60);
  });

  // ---------------------------------------------------------------------------
  // Enum Defaults
  // ---------------------------------------------------------------------------

  it('should use default log level of info', () => {
    const config = loadConfig(baseEnv);
    expect(config.logLevel).toBe('info');
  });

  it('should accept valid log levels', () => {
    for (const level of ['debug', 'info', 'warn', 'error'] as const) {
      const env = { ...baseEnv, LOG_LEVEL: level };
      const config = loadConfig(env);
      expect(config.logLevel).toBe(level);
    }
  });

  it('should use default for invalid log level', () => {
    const env = { ...baseEnv, LOG_LEVEL: 'verbose' };
    const config = loadConfig(env);
    expect(config.logLevel).toBe('info');
  });

  it('should use default environment of development', () => {
    const config = loadConfig(baseEnv);
    expect(config.environment).toBe('development');
  });

  it('should accept production environment', () => {
    const env = { ...baseEnv, NODE_ENV: 'production' };
    const config = loadConfig(env);
    expect(config.environment).toBe('production');
  });

  it('should use default for invalid environment', () => {
    const env = { ...baseEnv, NODE_ENV: 'staging' };
    const config = loadConfig(env);
    expect(config.environment).toBe('development');
  });

  // ---------------------------------------------------------------------------
  // Optional Channel IDs
  // ---------------------------------------------------------------------------

  it('should set announcements channel to null when not provided', () => {
    const config = loadConfig(baseEnv);
    expect(config.announcementsChannelId).toBeNull();
  });

  it('should set leaderboard channel to null when not provided', () => {
    const config = loadConfig(baseEnv);
    expect(config.leaderboardChannelId).toBeNull();
  });

  it('should set optional channel IDs when provided', () => {
    const env = {
      ...baseEnv,
      ANNOUNCEMENTS_CHANNEL_ID: 'announce-123',
      LEADERBOARD_CHANNEL_ID: 'leaderboard-456',
    };
    const config = loadConfig(env);
    expect(config.announcementsChannelId).toBe('announce-123');
    expect(config.leaderboardChannelId).toBe('leaderboard-456');
  });
});
