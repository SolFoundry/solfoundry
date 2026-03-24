# 02 — Check Contributor Stats

Fetch a contributor's reputation, tier, earnings, and badges.

```typescript
import { SolFoundry } from '@solfoundry/sdk';

const client = SolFoundry.create({ baseUrl: 'https://api.solfoundry.io' });

// Get a specific contributor's profile
const contributor = await client.contributors.get('octocat');

console.log(`Name:       ${contributor.display_name}`);
console.log(`Reputation: ${contributor.reputation_score} pts`);
console.log(`Tier:       T${contributor.tier}`);
console.log(`Completed:  ${contributor.total_bounties_completed} bounties`);
console.log(`Earnings:   ${contributor.total_earnings} $FNDRY`);
console.log(`Badges:     ${contributor.badges.join(', ')}`);
console.log(`Skills:     ${contributor.skills.join(', ')}`);

// Get platform-wide stats
const stats = await client.contributors.getStats();
console.log(`\nPlatform Stats:`);
console.log(`  Total contributors:  ${stats.total_contributors}`);
console.log(`  Bounties completed:  ${stats.total_bounties_completed}`);
console.log(`  Total FNDRY paid:    ${stats.total_fndry_paid}`);

// List top contributors
const list = await client.contributors.list({ limit: 10 });
list.contributors
  .sort((a, b) => b.reputation_score - a.reputation_score)
  .forEach((c, i) => {
    console.log(`  ${i + 1}. @${c.username} — ${c.reputation_score.toFixed(1)} pts`);
  });
```
