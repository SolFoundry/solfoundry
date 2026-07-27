import { describe, it, expect } from 'vitest';
import { loadAgentConfig, validateConfig } from '../src/config.js';

describe('config', () => {
  const clean = new Map<string, string | undefined>();
  beforeAll(() => {
    for (const [k, v] of Object.entries(process.env)) clean.set(k, v);
  });
  afterEach(() => {
    for (const [k, v] of clean) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    // Also delete keys the test added (not in the original snapshot).
    for (const k of Object.keys(process.env)) {
      if (!clean.has(k)) delete process.env[k];
    }
  });

  it('applies sensible defaults', () => {
    const cfg = loadAgentConfig();
    expect(cfg.baseUrl).toBe('https://api.solfoundry.io');
    expect(cfg.dryRun).toBe(false);
    expect(cfg.submitPrs).toBe(true);
    expect(cfg.targetRepo).toBe('solfoundry');
    expect(cfg.maxBounties).toBe(5);
    expect(cfg.maxReward).toBe(1000);
  });

  it('reads environment overrides', () => {
    process.env.SOLFOUNDRY_API_URL = 'https://custom.io';
    process.env.MAX_BOUNTIES = '10';
    process.env.DRY_RUN = 'true';
    const cfg = loadAgentConfig();
    expect(cfg.baseUrl).toBe('https://custom.io');
    expect(cfg.maxBounties).toBe(10);
    expect(cfg.dryRun).toBe(true);
  });

  it('reports missing env for claude', () => {
    const cfg = loadAgentConfig();
    const missing = validateConfig(cfg);
    expect(missing.includes('ANTHROPIC_API_KEY')).toBe(true);
  });

  it('does not require keys in dry-run mock mode', () => {
    process.env.LLM_BACKEND = 'mock';
    process.env.DRY_RUN = 'true';
    process.env.SUBMIT_PRS = 'false';
    const cfg = loadAgentConfig();
    const missing = validateConfig(cfg);
    expect(missing).toHaveLength(0);
  });

  it('requests github token when submitPrs=true', () => {
    process.env.LLM_BACKEND = 'mock';
    const cfg = loadAgentConfig();
    const missing = validateConfig(cfg);
    expect(missing.some((m) => m.startsWith('GITHUB_TOKEN'))).toBe(true);
    expect(missing.some((m) => m.startsWith('SOLFOUNDRY_API_TOKEN'))).toBe(true);
  });
});
