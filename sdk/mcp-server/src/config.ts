/**
 * SolFoundry MCP Server — Configuration Loader
 *
 * Resolution order:
 * 1. SOLFOUNDRY_BASE_URL / SOLFOUNDRY_TOKEN environment variables
 * 2. Hardcoded defaults (public read-only access)
 */
import type { SolFoundryConfig } from './types.js';

const DEFAULT_BASE_URL = 'https://api.solfoundry.io';

export function loadConfig(): SolFoundryConfig {
  return {
    baseUrl: process.env.SOLFOUNDRY_BASE_URL ?? DEFAULT_BASE_URL,
    authToken: process.env.SOLFOUNDRY_TOKEN,
  };
}
