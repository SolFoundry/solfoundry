/**
 * Example 05: Print the contributor leaderboard.
 *
 * Run: npx tsx examples/05-leaderboard.ts
 */

import { SolFoundry } from '../src/index.js';

const client = SolFoundry.create({
  baseUrl: process.env.SOLFOUNDRY_BASE_URL ?? 'https://api.solfoundry.io',
});

const list = await client.contributors.list({ limit: 20 });
const ranked = [...list.contributors].sort((a, b) => b.reputation_score - a.reputation_score);

console.log('🏆 SolFoundry Leaderboard\n');
ranked.forEach((c, i) => {
  const medal = ['🥇', '🥈', '🥉'][i] ?? `${String(i + 1).padStart(2)}.`;
  console.log(
    `${medal}  @${c.username.padEnd(20)} ` +
    `${String(c.reputation_score.toFixed(1)).padStart(7)} pts  ` +
    `T${c.tier ?? '?'}  ` +
    `${c.total_bounties_completed} bounties`,
  );
});
