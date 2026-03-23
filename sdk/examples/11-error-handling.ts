/**
 * Example 11: Typed error handling patterns.
 *
 * Run: npx tsx examples/11-error-handling.ts
 */

import {
  SolFoundry,
  NotFoundError,
  AuthenticationError,
  RateLimitError,
  NetworkError,
} from '../src/index.js';

const client = SolFoundry.create({
  baseUrl: process.env.SOLFOUNDRY_BASE_URL ?? 'https://api.solfoundry.io',
  maxRetries: 1,
});

async function safeGetBounty(id: string) {
  try {
    return await client.bounties.get(id);
  } catch (err) {
    if (err instanceof NotFoundError) {
      console.log(`Bounty "${id}" not found — returning null`);
      return null;
    }
    if (err instanceof AuthenticationError) {
      console.error('Auth error — set SOLFOUNDRY_TOKEN');
      return null;
    }
    if (err instanceof RateLimitError) {
      console.warn('Rate limited — wait and retry');
      return null;
    }
    if (err instanceof NetworkError) {
      console.error('Network error:', (err as Error).message);
      return null;
    }
    throw err;
  }
}

const bounty = await safeGetBounty('nonexistent-id');
console.log('Result:', bounty); // null
