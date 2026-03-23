# 06 — Submit a Solution

Submit a GitHub PR as a solution to an open bounty.

```typescript
import { SolFoundry } from '@solfoundry/sdk';

const client = SolFoundry.create({
  baseUrl: 'https://api.solfoundry.io',
  authToken: process.env.SOLFOUNDRY_TOKEN, // required
});

const bountyId = 'bounty-uuid-here';

// 1. Check the bounty is open before submitting
const bounty = await client.bounties.get(bountyId);

if (bounty.status !== 'open' && bounty.status !== 'in_progress') {
  console.log(`Bounty is ${bounty.status} — submissions not accepted`);
  process.exit(1);
}

// 2. Submit your PR
const submission = await client.bounties.submitSolution(bountyId, {
  pr_url: 'https://github.com/SolFoundry/solfoundry/pull/42',
  contributor_wallet: 'YourSolanaWalletBase58Address',
  notes: 'Implemented the feature with full test coverage.',
});

console.log(`Submission created: ${submission.id}`);
console.log(`Status: ${submission.status}`); // 'pending'

// 3. Poll for review status
const pollInterval = 30_000; // 30 seconds
const timer = setInterval(async () => {
  const submissions = await client.bounties.listSubmissions(bountyId);
  const mine = submissions.find((s) => s.id === submission.id);

  if (!mine) return;

  if (mine.status === 'approved') {
    console.log('🎉 Submission approved! Payout incoming.');
    clearInterval(timer);
  } else if (mine.status === 'rejected') {
    console.log('❌ Submission rejected.');
    clearInterval(timer);
  }
}, pollInterval);
```
