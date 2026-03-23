# 09 — GitHub Integration

Query bounty issues, check claim status, and verify completions via GitHub.

```typescript
import { GitHubClient } from '@solfoundry/sdk';

const github = new GitHubClient({ token: process.env.GITHUB_TOKEN });

// List all open bounty issues
const issues = await github.listBountyIssues({ state: 'open' });
console.log(`Open bounty issues: ${issues.length}`);
issues.forEach((issue) => {
  console.log(`  #${issue.number}: ${issue.title}`);
});

// Check if a specific issue has been claimed
const isClaimed = await github.isIssueClaimed(42);
console.log(`Issue #42 claimed: ${isClaimed}`);

// Check if a specific issue has been completed
const isCompleted = await github.isIssueCompleted(42);
console.log(`Issue #42 completed: ${isCompleted}`);

// List closed (completed) bounty issues
const closedIssues = await github.listBountyIssues({ state: 'closed' });
console.log(`Completed bounties: ${closedIssues.length}`);
```
