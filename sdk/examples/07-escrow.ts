/**
 * Example 07: Check escrow status for a bounty.
 *
 * Run: BOUNTY_ID=xxx npx tsx examples/07-escrow.ts
 */

import { SolFoundry, NotFoundError } from '../src/index.js';

const bountyId = process.env.BOUNTY_ID;
if (!bountyId) { console.error('Set BOUNTY_ID'); process.exit(1); }

const client = SolFoundry.create({
  baseUrl: process.env.SOLFOUNDRY_BASE_URL ?? 'https://api.solfoundry.io',
  authToken: process.env.SOLFOUNDRY_TOKEN,
});

try {
  const escrow = await client.escrow.getStatus(bountyId);
  console.log(`Escrow for bounty ${bountyId}:`);
  console.log(`  State:          ${escrow.state}`);
  console.log(`  Amount locked:  ${escrow.amount} $FNDRY`);
  console.log(`  Creator wallet: ${escrow.creator_wallet}`);
  console.log(`  Ledger entries: ${escrow.ledger.length}`);
  escrow.ledger.forEach((e) => console.log(`    [${e.action}] ${e.amount} — ${e.note ?? ''}`));
} catch (err) {
  if (err instanceof NotFoundError) {
    console.log('No escrow found for this bounty.');
  } else {
    throw err;
  }
}
