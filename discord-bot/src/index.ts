/**
 * SolFoundry Discord Bot — Entry Point.
 *
 * Loads configuration, initializes the bot, and handles
 * graceful shutdown on SIGTERM/SIGINT.
 *
 * @module index
 */

import { loadConfig } from './config.js';
import { SolFoundryBot } from './bot.js';
import { createLogger } from './utils/logger.js';

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  // Load and validate configuration
  const config = loadConfig();
  const logger = createLogger(config.logLevel);

  logger.info('SolFoundry Discord Bot starting...');
  logger.info(`Environment: ${config.environment}`);
  logger.info(`Bounty channel: ${config.bountyChannelId}`);
  logger.info(`API URL: ${config.solFoundryApiUrl}`);

  // Create and start the bot
  const bot = new SolFoundryBot(config);

  // Graceful shutdown handlers
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    await bot.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', reason);
  });

  // Start the bot
  try {
    await bot.start();
  } catch (error) {
    logger.error('Failed to start bot', error);
    process.exit(1);
  }
}

main();
