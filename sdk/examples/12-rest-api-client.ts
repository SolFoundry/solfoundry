/**
 * Example 12: Typed REST API clients (bounties, submissions, users).
 *
 * Run:
 *   SOLFOUNDRY_API_URL=https://api.solfoundry.io \
 *   SOLFOUNDRY_TOKEN=your_jwt \
 *   npx tsx examples/12-rest-api-client.ts
 */

import { SolFoundry } from '../src/index.js';

async function main(): Promise<void> {
  const baseUrl = process.env.SOLFOUNDRY_API_URL ?? 'https://api.solfoundry.io';
  const authToken = process.env.SOLFOUNDRY_TOKEN;

  const client = SolFoundry.create({
    baseUrl,
    authToken,
  });

  // 1) Typed bounties list
  const bountyPage = await client.api.bounties.list({ status: 'open', limit: 5, offset: 0 });
  console.log(`Loaded ${bountyPage.items.length} open bounties`);

  if (bountyPage.items.length === 0) {
    console.log('No open bounties found.');
    return;
  }

  const first = bountyPage.items[0];
  console.log(`First bounty: ${first.title} (${first.reward_amount} ${first.reward_token})`);

  // 2) Typed submissions list for the first bounty
  const submissions = await client.api.submissions.listForBounty(first.id);
  console.log(`Submissions for ${first.id}: ${submissions.length}`);

  // 3) Typed users endpoint (requires auth)
  if (authToken) {
    const me = await client.api.users.me();
    console.log(`Authenticated as: ${me.username}`);
  } else {
    console.log('Set SOLFOUNDRY_TOKEN to test /api/users/me');
  }
}

main().catch((error) => {
  console.error('Example failed:', error);
  process.exit(1);
});
