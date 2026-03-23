/**
 * Example 06: Submit a GitHub PR as a solution to a bounty.
 *
 * Run: BOUNTY_ID=xxx PR_URL=https://... npx tsx examples/06-submit-solution.ts
 */

import { SolFoundry } from '../src/index.js';

const bountyId = process.env.BOUNTY_ID;
const prUrl = process.env.PR_URL;

if (!bountyId || !prUrl) {
  console.error('Set BOUNTY_ID and PR_URL');
  process.exit(1);
}

const client = SolFoundry.create({
  baseUrl: process.env.SOLFOUNDRY_BASE_URL ?? 'https://api.solfoundry.io',
  authToken: process.env.SOLFOUNDRY_TOKEN,
});

const bounty = await client.bounties.get(bountyId);
console.log(`Bounty: ${bounty.title} (${bounty.status})`);

if (bounty.status !== 'open') {
  console.error('Bounty is not open for submissions.');
  process.exit(1);
}

const submission = await client.bounties.submitSolution(bountyId, {
  pr_url: prUrl,
  contributor_wallet: process.env.WALLET,
  notes: 'Implemented as specified with full test coverage.',
});

console.log(`\n✅ Submission created: ${submission.id}`);
console.log(`   Status: ${submission.status}`);
