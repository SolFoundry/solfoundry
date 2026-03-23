/**
 * Example 02: Fetch contributor profile and platform stats.
 *
 * Run: USERNAME=octocat npx tsx examples/02-contributor-stats.ts
 */

import { SolFoundry } from '../src/index.js';

const client = SolFoundry.create({
  baseUrl: process.env.SOLFOUNDRY_BASE_URL ?? 'https://api.solfoundry.io',
});

const username = process.env.USERNAME ?? 'octocat';

const contributor = await client.contributors.get(username);
console.log(`Profile: @${contributor.username}`);
console.log(`  Display name:  ${contributor.display_name}`);
console.log(`  Reputation:    ${contributor.reputation_score} pts`);
console.log(`  Tier:          T${contributor.tier ?? '?'}`);
console.log(`  Completed:     ${contributor.total_bounties_completed} bounties`);
console.log(`  Total earned:  ${contributor.total_earnings} $FNDRY`);

const stats = await client.contributors.getStats();
console.log(`\nPlatform stats:`);
console.log(`  Contributors:  ${stats.total_contributors}`);
console.log(`  Bounties done: ${stats.total_bounties_completed}`);
