# 08 — Search Bounties

Full-text search and autocomplete for the bounty marketplace.

```typescript
import { SolFoundry } from '@solfoundry/sdk';

const client = SolFoundry.create({ baseUrl: 'https://api.solfoundry.io' });

// Full-text search
const results = await client.bounties.search({
  q: 'typescript sdk',
  tier: 2,
  sort: 'reward_high',
  limit: 10,
});

console.log(`Found ${results.total} results for "typescript sdk":`);
results.results.forEach((b) => {
  console.log(`  [T${b.tier}] ${b.title} — ${b.reward_amount} $FNDRY`);
});

// Autocomplete — useful for search inputs
const suggestions = await client.bounties.autocomplete('solana', 5);
console.log('Autocomplete suggestions:');
suggestions.results.forEach((s) => console.log(`  - ${s}`));

// Search by required skill
const rustBounties = await client.bounties.search({ q: 'rust', sort: 'newest' });
console.log(`Rust bounties: ${rustBounties.total}`);
```
