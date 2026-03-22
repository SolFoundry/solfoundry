#!/usr/bin/env node
import { SolFoundryClient } from '../src';

const client = new SolFoundryClient();

const [,, command, ...args] = process.argv;

async function run() {
  switch (command) {
    case 'bounties': {
      const sub = args[0];
      if (sub === 'list') {
        const tier = args.find(a => a.startsWith('--tier='))?.split('=')[1];
        const status = args.find(a => a.startsWith('--status='))?.split('=')[1] ?? 'open';
        const result = await client.getBounties({ tier, status });
        console.log(`\nFound ${result.total} bounties:\n`);
        result.data.forEach(b => {
          console.log(`  #${b.id} [${b.tier}] ${b.title}`);
          console.log(`     Reward: ${b.reward.toLocaleString()} ${b.rewardToken} | Status: ${b.status}`);
          console.log(`     ${b.issueUrl}\n`);
        });
      } else {
        console.log('Usage: solfoundry bounties list [--tier=T2] [--status=open]');
      }
      break;
    }
    case 'bounty': {
      const sub = args[0];
      if (sub === 'get' && args[1]) {
        const bounty = await client.getBounty(args[1]);
        console.log(JSON.stringify(bounty, null, 2));
      } else {
        console.log('Usage: solfoundry bounty get <id>');
      }
      break;
    }
    case 'submit': {
      const [bountyId, prUrl, wallet] = args;
      if (!bountyId || !prUrl || !wallet) {
        console.log('Usage: solfoundry submit <bountyId> <prUrl> <walletAddress>');
        break;
      }
      const sub = await client.submitWork(bountyId, prUrl, wallet);
      console.log(`Submitted! Status: ${sub.status}`);
      break;
    }
    case 'contributors': {
      const result = await client.getContributors({ pageSize: 10 });
      console.log(`\nTop ${result.data.length} contributors:\n`);
      result.data.forEach((c, i) => {
        console.log(`  ${i + 1}. ${c.username} (${c.address.slice(0, 8)}...)`);
        console.log(`     Completed: ${c.completedBounties} | Earned: ${c.totalEarned.toLocaleString()} | Rep: ${c.reputationScore}\n`);
      });
      break;
    }
    default:
      console.log(`
SolFoundry CLI — Interact with the SolFoundry bounty platform

Commands:
  bounties list [--tier=T2] [--status=open]   List bounties
  bounty get <id>                              Get bounty details
  submit <bountyId> <prUrl> <wallet>           Submit work for a bounty
  contributors                                 Show top contributors

Examples:
  solfoundry bounties list --tier=T3
  solfoundry bounty get bounty-123
  solfoundry submit bounty-123 https://github.com/SolFoundry/solfoundry/pull/1 MyWallet
`);
  }
}

run().catch(err => { console.error(err.message); process.exit(1); });
