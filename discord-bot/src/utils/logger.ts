/**
 * Structured logging utility for the SolFoundry Discord Bot.
 *
 * Provides timestamped, leveled logging with configurable verbosity.
 * Supports debug, info, warn, and error levels.
 *
 * @module logger
 */

import type { LogLevel } from '../config.js';

/** Map of log levels to numeric severity for comparison. */
const LEVEL_SEVERITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** Emoji prefixes for each log level (for console readability). */
const LEVEL_PREFIX: Record<LogLevel, string> = {
  debug: '🔍',
  info: 'ℹ️',
  warn: '⚠️',
  error: '❌',
};

/**
 * Logger instance with configurable log level.
 */
export class Logger {
  private readonly level: LogLevel;

  /**
   * Create a new Logger.
   *
   * @param level - Minimum log level to output.
   */
  constructor(level: LogLevel = 'info') {
    this.level = level;
  }

  /**
   * Check if a given log level should be output.
   *
   * @param level - The level to check.
   * @returns True if the level meets the minimum threshold.
   */
  private shouldLog(level: LogLevel): boolean {
    return LEVEL_SEVERITY[level] >= LEVEL_SEVERITY[this.level];
  }

  /**
   * Format a log message with timestamp and level prefix.
   *
   * @param level - The log level.
   * @param message - The log message.
   * @returns Formatted log string.
   */
  private format(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    const prefix = LEVEL_PREFIX[level];
    return `${timestamp} ${prefix} [${level.toUpperCase()}] ${message}`;
  }

  /**
   * Log a debug message.
   *
   * @param message - The message to log.
   * @param data - Optional additional data to include.
   */
  debug(message: string, data?: unknown): void {
    if (!this.shouldLog('debug')) return;
    const formatted = this.format('debug', message);
    if (data !== undefined) {
      console.debug(formatted, JSON.stringify(data, null, 2));
    } else {
      console.debug(formatted);
    }
  }

  /**
   * Log an informational message.
   *
   * @param message - The message to log.
   * @param data - Optional additional data to include.
   */
  info(message: string, data?: unknown): void {
    if (!this.shouldLog('info')) return;
    const formatted = this.format('info', message);
    if (data !== undefined) {
      console.info(formatted, JSON.stringify(data, null, 2));
    } else {
      console.info(formatted);
    }
  }

  /**
   * Log a warning message.
   *
   * @param message - The message to log.
   * @param data - Optional additional data to include.
   */
  warn(message: string, data?: unknown): void {
    if (!this.shouldLog('warn')) return;
    const formatted = this.format('warn', message);
    if (data !== undefined) {
      console.warn(formatted, JSON.stringify(data, null, 2));
    } else {
      console.warn(formatted);
    }
  }

  /**
   * Log an error message.
   *
   * @param message - The message to log.
   * @param error - Optional error object to include.
   */
  error(message: string, error?: Error | unknown): void {
    if (!this.shouldLog('error')) return;
    const formatted = this.format('error', message);
    if (error instanceof Error) {
      console.error(formatted, error.stack || error.message);
    } else if (error !== undefined) {
      console.error(formatted, JSON.stringify(error, null, 2));
    } else {
      console.error(formatted);
    }
  }

  /**
   * Create a child logger with a contextual prefix.
   *
   * @param context - Context label to prepend to messages.
   * @returns A new Logger instance that prefixes messages.
   */
  child(context: string): ContextualLogger {
    return new ContextualLogger(this, context);
  }
}

/**
 * Logger with a contextual prefix for module-specific logging.
 */
export class ContextualLogger {
  private readonly parent: Logger;
  private readonly context: string;

  /**
   * Create a contextual logger.
   *
   * @param parent - The parent logger instance.
   * @param context - Context label to prepend.
   */
  constructor(parent: Logger, context: string) {
    this.parent = parent;
    this.context = context;
  }

  debug(message: string, data?: unknown): void {
    this.parent.debug(`[${this.context}] ${message}`, data);
  }

  info(message: string, data?: unknown): void {
    this.parent.info(`[${this.context}] ${message}`, data);
  }

  warn(message: string, data?: unknown): void {
    this.parent.warn(`[${this.context}] ${message}`, data);
  }

  error(message: string, error?: Error | unknown): void {
    this.parent.error(`[${this.context}] ${message}`, error);
  }
}

/**
 * Create a logger instance with the specified level.
 *
 * @param level - Minimum log level (default: 'info').
 * @returns Configured Logger instance.
 */
export function createLogger(level: LogLevel = 'info'): Logger {
  return new Logger(level);
}
