# 05 — Query Leaderboard

Fetch the top contributors ranked by reputation score.

```typescript
import { SolFoundry } from '@solfoundry/sdk';

const client = SolFoundry.create({ baseUrl: 'https://api.solfoundry.io' });

// Get top 10 contributors
const leaderboard = await client.contributors.list({ limit: 10 });

const ranked = [...leaderboard.contributors].sort(
  (a, b) => b.reputation_score - a.reputation_score,
);

console.log('🏆 SolFoundry Leaderboard\n');
ranked.forEach((c, i) => {
  const medal = ['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`;
  console.log(
    `${medal} @${c.username.padEnd(20)} | ` +
    `${c.reputation_score.toFixed(1).padStart(7)} pts | ` +
    `T${c.tier ?? '?'} | ` +
    `${c.total_bounties_completed} bounties`,
  );
});

// Filter to only T2+ contributors
const veterans = ranked.filter((c) => (c.tier ?? 0) >= 2);
console.log(`\n${veterans.length} Tier-2+ contributors on the leaderboard`);
```
