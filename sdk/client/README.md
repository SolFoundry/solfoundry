# @solfoundry/sdk

> Comprehensive TypeScript SDK for the [SolFoundry](https://solfoundry.com) bounty platform.

## Installation

```bash
npm install @solfoundry/sdk
# or
yarn add @solfoundry/sdk
# or
pnpm add @solfoundry/sdk
```

## Quick Start

```typescript
import { SolFoundryClient } from '@solfoundry/sdk';

// Create a client (no auth needed for public endpoints)
const client = new SolFoundryClient();

// List open bounties
const { data: bounties } = await client.bounties.list({
  status: 'open',
  tier: 'T3',
  limit: 10,
});

for (const bounty of bounties) {
  console.log(`🎯 ${bounty.title}`);
  console.log(`   Reward: ${bounty.reward.amount} ${bounty.reward.token}`);
  console.log(`   Skills: ${bounty.skills.join(', ')}`);
}
```

## Authentication

### GitHub OAuth Flow

The SDK supports the full GitHub OAuth flow:

```typescript
import { SolFoundryClient } from '@solfoundry/sdk';

const client = new SolFoundryClient();

// Step 1: Get the GitHub authorize URL
const authorizeUrl = await client.auth.getGitHubAuthorizeUrl();
// Redirect your user to authorizeUrl...

// Step 2: Exchange the code from the callback
const tokens = await client.auth.exchangeGitHubCode('code-from-callback');
console.log('Access token:', tokens.accessToken);

// Step 3: Create an authenticated client
const authClient = new SolFoundryClient({
  accessToken: tokens.accessToken,
  refreshToken: tokens.refreshToken,
  onTokensRefreshed: (newTokens) => {
    // Save the refreshed tokens
    console.log('Token refreshed!');
  },
});

// Tokens auto-refresh on 401 responses
const me = await authClient.auth.getMe();
console.log(`Logged in as ${me.githubUsername}`);
```

### Manual Token

If you already have an access token:

```typescript
const client = new SolFoundryClient({
  accessToken: 'your-jwt-token',
});
```

## Configuration

```typescript
const client = new SolFoundryClient({
  // Base URL (default: https://solfoundry.com)
  baseUrl: 'https://solfoundry.com',

  // Auth tokens
  accessToken: 'your-jwt',
  refreshToken: 'your-refresh-token',

  // Called when tokens are auto-refreshed
  onTokensRefreshed: (tokens) => { /* persist tokens */ },

  // Rate limiting (default: 10 req/s)
  maxRequestsPerSecond: 5,

  // Retry (default: 3 retries)
  maxRetries: 5,

  // Request timeout in ms (default: 30000)
  timeout: 15000,
});
```

## API Reference

### Bounties

#### List Bounties

```typescript
const result = await client.bounties.list({
  status: 'open',        // 'open' | 'in_progress' | 'in_review' | 'completed' | 'cancelled' | 'expired'
  tier: 'T3',            // 'T1' | 'T2' | 'T3' | 'T4'
  reward_token: 'FNDRY', // 'SOL' | 'USDC' | 'FNDRY'
  skill: 'typescript',
  limit: 20,
  offset: 0,
});

console.log(`Total: ${result.total}`);
for (const bounty of result.data) {
  console.log(bounty.title, bounty.reward);
}
```

#### Get a Bounty

```typescript
const bounty = await client.bounties.get('bounty-id');
console.log(bounty.title, bounty.description, bounty.deadline);
```

#### Create a Bounty *(requires auth)*

```typescript
const bounty = await client.bounties.create({
  title: 'Build a TypeScript SDK',
  description: 'Create a comprehensive SDK for SolFoundry API...',
  tier: 'T3',
  rewardToken: 'FNDRY',
  rewardAmount: '900000',
  skills: ['typescript', 'sdk', 'api-design'],
  deadline: '2025-12-31T23:59:59Z',
});
```

### Submissions

#### List Submissions

```typescript
const { data: submissions } = await client.bounties.listSubmissions('bounty-id');
for (const sub of submissions) {
  console.log(`${sub.title} — ${sub.status}`);
}
```

#### Create a Submission *(requires auth)*

```typescript
const submission = await client.bounties.createSubmission('bounty-id', {
  title: 'My Implementation',
  description: 'Full SDK with TypeScript types, retry logic, and auth management.',
  links: [
    'https://github.com/user/repo/pull/42',
    'https://npmjs.com/package/@solfoundry/sdk',
  ],
});
```

### Treasury & Escrow

#### Get Deposit Info

```typescript
const depositInfo = await client.treasury.getTreasuryDepositInfo('bounty-id');
// Send depositInfo.amount of depositInfo.token to depositInfo.walletAddress
// with depositInfo.memo as the transaction memo
console.log(`Send ${depositInfo.amount} ${depositInfo.token} to ${depositInfo.walletAddress}`);
```

#### Verify Escrow Deposit

```typescript
const result = await client.treasury.verifyEscrowDeposit({
  bountyId: 'bounty-id',
  transactionSignature: '5Kt7n...signature',
});
console.log(result.verified ? '✅ Deposit confirmed' : '❌ Not found');
```

### Review Fees

#### Get Review Fee

```typescript
const fee = await client.reviewFee.getReviewFee('bounty-id');
console.log(`Review fee: ${fee.amount} ${fee.token} to ${fee.walletAddress}`);
```

#### Verify Review Fee Payment

```typescript
const result = await client.reviewFee.verify({
  bountyId: 'bounty-id',
  transactionSignature: '5Kt7n...signature',
});
```

### Leaderboard

```typescript
const { data: leaders } = await client.leaderboard.get('monthly');
for (const entry of leaders) {
  console.log(`#${entry.rank} ${entry.name} — ${entry.bountiesCompleted} bounties, $${entry.totalEarnings}`);
}
```

### Platform Stats

```typescript
const stats = await client.stats.get();
console.log(`${stats.openBounties} open bounties`);
console.log(`$${stats.totalDistributed} distributed`);
console.log(`${stats.totalUsers} users`);
```

## Error Handling

```typescript
import { SolFoundryClient, SolFoundryError } from '@solfoundry/sdk';

try {
  const bounty = await client.bounties.get('invalid-id');
} catch (error) {
  if (error instanceof SolFoundryError) {
    console.error(`API Error [${error.code}]: ${error.message}`);
    console.error(`Status: ${error.statusCode}`);

    if (error.isClientError) {
      // 4xx - check your request
    } else if (error.isServerError) {
      // 5xx - server issue, will be retried automatically
    }

    if (error.details) {
      console.error('Details:', error.details);
    }
  } else {
    throw error;
  }
}
```

## Tree-Shaking

The SDK supports tree-shaking via named exports:

```typescript
// Import only what you need
import { SolFoundryClient } from '@solfoundry/sdk';
import type { Bounty, BountyStatus } from '@solfoundry/sdk';
```

## Requirements

- Node.js >= 18.0.0 (uses native `fetch`)
- TypeScript >= 5.0 (for type checking)

## License

MIT
