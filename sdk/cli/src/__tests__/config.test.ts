import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../utils/config.js';

describe('loadConfig', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore env
    Object.keys(process.env).forEach((k) => {
      if (!(k in originalEnv)) delete process.env[k];
    });
    Object.assign(process.env, originalEnv);
  });

  it('returns default base URL when env var is not set', () => {
    delete process.env.SOLFOUNDRY_BASE_URL;
    delete process.env.SOLFOUNDRY_TOKEN;
    const config = loadConfig();
    expect(config.baseUrl).toBe('https://api.solfoundry.io');
    expect(config.authToken).toBeUndefined();
  });

  it('reads SOLFOUNDRY_BASE_URL from environment', () => {
    process.env.SOLFOUNDRY_BASE_URL = 'http://localhost:8000';
    const config = loadConfig();
    expect(config.baseUrl).toBe('http://localhost:8000');
  });

  it('reads SOLFOUNDRY_TOKEN from environment', () => {
    process.env.SOLFOUNDRY_TOKEN = 'test-jwt-token';
    const config = loadConfig();
    expect(config.authToken).toBe('test-jwt-token');
  });
});
