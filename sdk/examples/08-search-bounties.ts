/**
 * Example 08: Full-text search and autocomplete.
 *
 * Run: QUERY="typescript" npx tsx examples/08-search-bounties.ts
 */

import { SolFoundry } from '../src/index.js';

const query = process.env.QUERY ?? 'typescript';
const client = SolFoundry.create({ baseUrl: process.env.SOLFOUNDRY_BASE_URL ?? 'https://api.solfoundry.io' });

const results = await client.bounties.search({ q: query, sort: 'reward_high', limit: 5 });
console.log(`Search: "${query}" → ${results.total} results\n`);
results.results.forEach((b) => {
  console.log(`  [T${b.tier}] ${b.title} — ${b.reward_amount} $FNDRY`);
});

const suggestions = await client.bounties.autocomplete(query, 5);
console.log('\nAutocomplete suggestions:');
suggestions.results.forEach((s) => console.log(`  - ${s}`));
