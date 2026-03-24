/**
 * Example 01: List open bounties with filtering and pagination.
 *
 * Run: npx tsx examples/01-list-bounties.ts
 */

import { SolFoundry } from '../src/index.js';

const client = SolFoundry.create({
  baseUrl: process.env.SOLFOUNDRY_BASE_URL ?? 'https://api.solfoundry.io',
});

const page = await client.bounties.list({ status: 'open', limit: 10 });
console.log(`Open bounties (${page.total} total):\n`);

for (const b of page.bounties) {
  console.log(`  [T${b.tier}] ${b.title}`);
  console.log(`         Reward: ${b.reward_amount} $FNDRY | Status: ${b.status}\n`);
}
