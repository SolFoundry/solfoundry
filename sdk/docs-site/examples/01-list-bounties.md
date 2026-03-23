# 01 — List Open Bounties

Fetch, filter, and paginate bounties from the marketplace.

```typescript
import { SolFoundry } from '@solfoundry/sdk';

const client = SolFoundry.create({ baseUrl: 'https://api.solfoundry.io' });

// List first page of open bounties
const page1 = await client.bounties.list({ status: 'open', limit: 10, skip: 0 });
console.log(`Total open: ${page1.total}`);

for (const b of page1.bounties) {
  console.log(`[T${b.tier}] ${b.title} — ${b.reward_amount} $FNDRY`);
}

// Filter by tier
const t2Bounties = await client.bounties.list({ status: 'open', tier: 2, limit: 5 });
console.log('Tier-2 bounties:', t2Bounties.bounties.map(b => b.title));

// Paginate through all open bounties
async function* allOpenBounties(pageSize = 20) {
  let skip = 0;
  while (true) {
    const page = await client.bounties.list({ status: 'open', limit: pageSize, skip });
    yield* page.bounties;
    if (page.bounties.length < pageSize) break;
    skip += pageSize;
  }
}

for await (const bounty of allOpenBounties()) {
  console.log(bounty.id, bounty.title);
}
```
