import { SolFoundryClient } from '../src';

async function main() {
  const client = new SolFoundryClient({
    apiBaseUrl: 'https://api.solfoundry.io',
  });

  // List open T2 bounties
  console.log('Fetching open T2 bounties...');
  const bounties = await client.getBounties({ tier: 'T2', status: 'open' });
  console.log(`Found ${bounties.total} bounties`);
  bounties.data.forEach(b => {
    console.log(`  [${b.tier}] ${b.title} — ${b.reward.toLocaleString()} ${b.rewardToken}`);
  });

  // Get contributor stats
  console.log('\nFetching top contributors...');
  const contributors = await client.getContributors({ pageSize: 5 });
  contributors.data.forEach(c => {
    console.log(`  ${c.username} — ${c.completedBounties} bounties, ${c.totalEarned.toLocaleString()} earned`);
  });

  // Submit work (example)
  const MY_WALLET = 'YourWalletAddressHere';
  const BOUNTY_ID = 'bounty-123';
  const PR_URL = 'https://github.com/SolFoundry/solfoundry/pull/999';
  const submission = await client.submitWork(BOUNTY_ID, PR_URL, MY_WALLET);
  console.log(`\nSubmission status: ${submission.status}`);
}

main().catch(console.error);
