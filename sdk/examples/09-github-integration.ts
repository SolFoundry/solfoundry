/**
 * Example 09: GitHub Issues integration.
 *
 * Run: GITHUB_TOKEN=ghp_xxx npx tsx examples/09-github-integration.ts
 */

import { GitHubClient } from '../src/index.js';

const github = new GitHubClient({ token: process.env.GITHUB_TOKEN });

const openIssues = await github.listBountyIssues({ state: 'open' });
console.log(`Open bounty issues: ${openIssues.length}`);
openIssues.slice(0, 5).forEach((i) => console.log(`  #${i.number}: ${i.title}`));

if (openIssues.length > 0) {
  const num = openIssues[0].number;
  const claimed = await github.isIssueClaimed(num);
  const completed = await github.isIssueCompleted(num);
  console.log(`\nIssue #${num}: claimed=${claimed}, completed=${completed}`);
}
