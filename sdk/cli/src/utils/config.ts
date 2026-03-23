/**
 * CLI configuration loader.
 *
 * Resolution order:
 * 1. SOLFOUNDRY_BASE_URL / SOLFOUNDRY_TOKEN environment variables
 * 2. Hardcoded defaults (public read-only access)
 */

export interface CliConfig {
  baseUrl: string;
  authToken: string | undefined;
}

export function loadConfig(): CliConfig {
  return {
    baseUrl: process.env.SOLFOUNDRY_BASE_URL ?? 'https://api.solfoundry.io',
    authToken: process.env.SOLFOUNDRY_TOKEN,
  };
}
