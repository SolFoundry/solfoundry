/**
 * Tests for the logging utility.
 *
 * Validates log level filtering, formatting, and contextual logging.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger, Logger, ContextualLogger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Logger Tests
// ---------------------------------------------------------------------------

describe('Logger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create a logger with default info level', () => {
    const logger = createLogger();
    expect(logger).toBeInstanceOf(Logger);
  });

  it('should log info messages at info level', () => {
    const logger = createLogger('info');
    logger.info('test message');
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('should not log debug messages at info level', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const logger = createLogger('info');
    logger.debug('debug message');
    expect(debugSpy).not.toHaveBeenCalled();
  });

  it('should log debug messages at debug level', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const logger = createLogger('debug');
    logger.debug('debug message');
    expect(debugSpy).toHaveBeenCalled();
  });

  it('should log warn messages at warn level', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logger = createLogger('warn');
    logger.warn('warn message');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('should not log info messages at warn level', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const logger = createLogger('warn');
    logger.info('info message');
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('should log error messages at error level', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logger = createLogger('error');
    logger.error('error message');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('should not log warn messages at error level', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logger = createLogger('error');
    logger.warn('warn message');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('should include data in log output', () => {
    const logger = createLogger('info');
    logger.info('test message', { key: 'value' });
    expect(consoleSpy).toHaveBeenCalled();
    const callArgs = consoleSpy.mock.calls[0];
    expect(callArgs[0]).toContain('test message');
  });

  it('should log error with Error object', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logger = createLogger('error');
    const error = new Error('test error');
    logger.error('error occurred', error);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('should create a child logger', () => {
    const logger = createLogger('info');
    const child = logger.child('TestModule');
    expect(child).toBeInstanceOf(ContextualLogger);
  });

  it('should prefix child logger messages with context', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const logger = createLogger('info');
    const child = logger.child('MyModule');
    child.info('test message');
    expect(infoSpy).toHaveBeenCalled();
    const callArgs = infoSpy.mock.calls[0];
    expect(callArgs[0]).toContain('[MyModule]');
  });
});

// ---------------------------------------------------------------------------
// ContextualLogger Tests
// ---------------------------------------------------------------------------

describe('ContextualLogger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should prefix all messages with context', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const logger = createLogger('info');
    const child = logger.child('Context');
    child.info('message');
    const callArgs = infoSpy.mock.calls[0];
    expect(callArgs[0]).toContain('[Context]');
  });

  it('should respect parent log level', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const logger = createLogger('warn');
    const child = logger.child('Context');
    child.debug('debug message');
    expect(debugSpy).not.toHaveBeenCalled();
  });
});
