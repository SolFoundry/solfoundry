# @solfoundry/sdk

TypeScript SDK for interacting with SolFoundry's on-chain programs and REST APIs.

## Installation

```bash
npm install @solfoundry/sdk
```

## Quick Start

```typescript
import { SolFoundry, GitHubClient, createConnection, PublicKey, getTokenBalance } from '@solfoundry/sdk';

// Create the API client
const client = SolFoundry.create({
  baseUrl: 'https://api.solfoundry.io',
  authToken: 'your-jwt-token',       // optional, required for mutations
  maxRetries: 3,                       // automatic retry on transient failures
  maxRequestsPerSecond: 10,            // built-in rate limiting
});

// List open bounties
const bounties = await client.bounties.list({ status: 'open', limit: 10 });

// Search with filters
const results = await client.bounties.search({
  q: 'typescript',
  tier: 2,
  sort: 'reward_high',
});

// Submit a solution
const submission = await client.bounties.submitSolution('bounty-uuid', {
  pr_url: 'https://github.com/SolFoundry/solfoundry/pull/123',
  contributor_wallet: 'YourSolanaWalletAddress',
});

// Check escrow status
const escrow = await client.escrow.getStatus('bounty-uuid');

// Get platform stats
const stats = await client.contributors.getStats();
```

## Solana Helpers

```typescript
import {
  createConnection,
  PublicKey,
  getTokenBalance,
  getSolBalance,
  findAssociatedTokenAddress,
  toRawAmount,
  toUiAmount,
  isValidSolanaAddress,
} from '@solfoundry/sdk';

const connection = createConnection('https://api.mainnet-beta.solana.com');
const wallet = new PublicKey('YourWalletAddress');

// Get $FNDRY balance
const balance = await getTokenBalance(connection, wallet);
console.log(`${balance.balance} FNDRY`);

// Get SOL balance
const sol = await getSolBalance(connection, wallet);
console.log(`${sol.balanceSol} SOL`);

// Validate addresses
isValidSolanaAddress('valid-base58-address'); // true

// Convert amounts
const raw = toRawAmount(1.5);    // 1500000000n (bigint)
const ui = toUiAmount(raw);       // 1.5
```

## GitHub Integration

```typescript
import { GitHubClient } from '@solfoundry/sdk';

const github = new GitHubClient({ token: 'ghp_xxx' });

// List bounty issues
const issues = await github.listBountyIssues({ state: 'open' });

// Check claim status
const claimed = await github.isIssueClaimed(42);

// Verify completion
const completed = await github.isIssueCompleted(42);
```

## Real-time Events

```typescript
import { EventSubscriber } from '@solfoundry/sdk';

const events = new EventSubscriber({
  wsUrl: 'wss://api.solfoundry.io/ws',
  token: 'auth-token',
  autoReconnect: true,
});

events.on('bounty_created', (event) => {
  console.log('New bounty:', event.data);
});

events.onConnect(() => {
  events.subscribe('bounty-uuid');
});

await events.connect();
```

## Error Handling

```typescript
import { SolFoundry, NotFoundError, AuthenticationError, RateLimitError } from '@solfoundry/sdk';

try {
  const bounty = await client.bounties.get('invalid-uuid');
} catch (error) {
  if (error instanceof NotFoundError) {
    console.log('Bounty not found');
  } else if (error instanceof AuthenticationError) {
    console.log('Please authenticate first');
  } else if (error instanceof RateLimitError) {
    console.log('Rate limited, please wait');
  }
}
```

## API Reference

### `SolFoundry.create(config)`

Factory method. Returns a client with `.bounties`, `.escrow`, and `.contributors` sub-clients.

### `BountyClient`

| Method | Description |
|--------|-------------|
| `list(options?)` | List bounties with pagination |
| `get(id)` | Get bounty by UUID |
| `create(data)` | Create a new bounty |
| `update(id, data)` | Partial update (PATCH) |
| `delete(id)` | Delete a bounty |
| `submitSolution(id, data)` | Submit a PR solution |
| `listSubmissions(id)` | List submissions for a bounty |
| `updateSubmissionStatus(bountyId, subId, data)` | Update submission status |
| `search(params)` | Full-text search with filters |
| `autocomplete(query, limit?)` | Search autocomplete |

### `EscrowClient`

| Method | Description |
|--------|-------------|
| `fund(data)` | Lock $FNDRY in escrow |
| `release(data)` | Release to bounty winner |
| `refund(data)` | Refund to bounty creator |
| `getStatus(bountyId)` | Get state + audit ledger |

### `ContributorClient`

| Method | Description |
|--------|-------------|
| `list(options?)` | List contributors |
| `get(id)` | Get contributor profile |
| `create(data)` | Register contributor |
| `update(id, data)` | Update profile |
| `getStats()` | Platform statistics |
| `getHealth()` | Service health check |

## License

MIT
