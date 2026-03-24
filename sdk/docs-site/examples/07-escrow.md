# 07 — Manage Escrow

Fund, inspect, and release a bounty escrow.

```typescript
import { SolFoundry } from '@solfoundry/sdk';

const client = SolFoundry.create({
  baseUrl: 'https://api.solfoundry.io',
  authToken: process.env.SOLFOUNDRY_TOKEN,
});

const bountyId = 'bounty-uuid-here';

// 1. Check current escrow state
const escrow = await client.escrow.getStatus(bountyId);
console.log(`State:  ${escrow.state}`);
console.log(`Amount: ${escrow.amount} $FNDRY`);
console.log(`Wallet: ${escrow.creator_wallet}`);
if (escrow.ledger.length > 0) {
  console.log('Ledger:');
  escrow.ledger.forEach((entry) => {
    console.log(`  [${entry.action}] ${entry.amount} $FNDRY — ${entry.note ?? ''}`);
  });
}

// 2. Fund escrow when creating a bounty
const funded = await client.escrow.fund({
  bounty_id: bountyId,
  creator_wallet: 'CreatorWalletAddress',
  amount: 1000,
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
});
console.log(`Funded: ${funded.state}`); // 'active'

// 3. Release escrow to winner
const released = await client.escrow.release({
  bounty_id: bountyId,
  winner_wallet: 'WinnerWalletAddress',
});
console.log(`Released: ${released.state}`); // 'completed'

// 4. Refund escrow to creator (if bounty cancelled)
const refunded = await client.escrow.refund({ bounty_id: bountyId });
console.log(`Refunded: ${refunded.state}`); // 'refunded'
```
