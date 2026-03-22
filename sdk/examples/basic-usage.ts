/**
 * SolFoundry SDK — Basic usage example
 *
 * Run:  npx ts-node --esm examples/basic-usage.ts
 */

import { SolFoundryClient, SolFoundryError } from '../src/index.js';

// ── 1. Create a client ────────────────────────────────────────────────────────
const client = new SolFoundryClient({
  // apiKey: process.env.SOLFOUNDRY_API_KEY,  // optional: required for submit
  baseUrl: process.env.SOLFOUNDRY_API_URL ?? 'https://api.solfoundry.io',
});

async function main() {
  try {
    // ── 2. List open bounties ───────────────────────────────────────────────
    console.log('\n📋 Fetching open bounties…');
    const bounties = await client.getBounties({ status: 'open', pageSize: 5 });
    console.log(`Found ${bounties.total} open bounties (showing first ${bounties.data.length}):`);
    for (const bounty of bounties.data) {
      console.log(
        `  [${bounty.tier}] #${bounty.issueNumber} — ${bounty.title} — ${bounty.reward.toLocaleString()} ${bounty.rewardToken}`,
      );
    }

    // ── 3. Fetch a single bounty ────────────────────────────────────────────
    if (bounties.data.length > 0) {
      const first = bounties.data[0];
      console.log(`\n🔍 Fetching bounty ${first.id}…`);
      const detail = await client.getBounty(first.id);
      console.log(`  Title:   ${detail.title}`);
      console.log(`  Status:  ${detail.status}`);
      console.log(`  Reward:  ${detail.reward.toLocaleString()} ${detail.rewardToken}`);
      console.log(`  Tags:    ${detail.tags.join(', ')}`);
    }

    // ── 4. List contributors ────────────────────────────────────────────────
    console.log('\n👥 Fetching top contributors…');
    const contributors = await client.getContributors({ pageSize: 5 });
    console.log(`Found ${contributors.total} contributors (showing first ${contributors.data.length}):`);
    for (const c of contributors.data) {
      console.log(
        `  @${c.githubHandle} — Rep: ${c.reputation} — Completed: ${c.bountiesCompleted}`,
      );
    }

    // ── 5. Submit work (requires API key) ──────────────────────────────────
    const apiKey = process.env.SOLFOUNDRY_API_KEY;
    if (apiKey && bounties.data.length > 0) {
      const clientWithKey = new SolFoundryClient({ apiKey, baseUrl: client['baseUrl'] });
      console.log('\n📤 Submitting work…');
      const submission = await clientWithKey.submitWork({
        bountyId: bounties.data[0].id,
        prUrl: 'https://github.com/SolFoundry/solfoundry/pull/999',
        notes: 'Implemented the feature as described in the issue.',
      });
      console.log(`  Submission ID: ${submission.id}`);
      console.log(`  Status:        ${submission.status}`);
    } else {
      console.log('\n⚠️  Set SOLFOUNDRY_API_KEY to test submitWork()');
    }

    console.log('\n✅ All done!');
  } catch (err) {
    if (err instanceof SolFoundryError) {
      console.error(`\n❌ SolFoundry API error [${err.statusCode ?? 'N/A'}]: ${err.message}`);
      if (err.code) console.error(`   Code: ${err.code}`);
    } else {
      console.error('\n❌ Unexpected error:', err);
    }
    process.exit(1);
  }
}

main();
