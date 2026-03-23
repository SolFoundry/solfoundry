/**
 * Shared client factory for CLI commands.
 */

import { SolFoundry } from '@solfoundry/sdk';
import { loadConfig } from './config.js';

export function createClient() {
  const config = loadConfig();
  return SolFoundry.create({
    baseUrl: config.baseUrl,
    authToken: config.authToken,
    maxRetries: 2,
    maxRequestsPerSecond: 5,
  });
}
