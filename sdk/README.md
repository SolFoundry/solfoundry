# @solfoundry/sdk

[![npm version](https://img.shields.io/npm/v/@solfoundry/sdk?color=orange)](https://www.npmjs.com/package/@solfoundry/sdk)
[![CI](https://github.com/SolFoundry/solfoundry/actions/workflows/ci.yml/badge.svg)](https://github.com/SolFoundry/solfoundry/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-95%25-brightgreen)](https://github.com/SolFoundry/solfoundry/tree/main/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)

TypeScript SDK for the [SolFoundry](https://solfoundry.io) bounty marketplace on Solana.

**[📖 Full Docs](https://docs.solfoundry.io)** · **[🔧 CLI Reference](https://docs.solfoundry.io/guide/cli-commands)** · **[📋 Examples](https://docs.solfoundry.io/examples/)** · **[🔌 API Reference](https://docs.solfoundry.io/api/)**

---

## Installation

```bash
npm install @solfoundry/sdk
```

Node.js **18+** required.

## Quick Start

```typescript
import { SolFoundry } from '@solfoundry/sdk';

const client = SolFoundry.create({
  baseUrl: 'https://api.solfoundry.io',
  authToken: process.env.SOLFOUNDRY_TOKEN, // optional for read-only
});

// List open bounties
const bounties = await client.bounties.list({ status: 'open', limit: 10 });
console.log(`${bounties.total} open bounties`);
bounties.bounties.forEach(b => console.log(`[T${b.tier}] ${b.title} — ${b.reward_amount} $FNDRY`));

// Get a specific bounty
const bounty = await client.bounties.get('bounty-uuid');

// Check contributor stats
const profile = await client.contributors.get('octocat');
console.log(`${profile.display_name}: ${profile.reputation_score} pts (T${profile.tier})`);

// Check escrow status
const escrow = await client.escrow.getStatus('bounty-uuid');
console.log(`Escrow: ${escrow.state} — ${escrow.amount} $FNDRY locked`);
```

## CLI

```bash
# One-off (no install needed)
npx @solfoundry/cli bounties
npx @solfoundry/cli status <bounty-id>
npx @solfoundry/cli profile <github-username>
npx @solfoundry/cli verify <tx-hash>

# Global install
npm install -g @solfoundry/cli
solfoundry bounties --tier 2 --limit 5
```

## Solana Helpers

```typescript
import { createConnection, PublicKey, getTokenBalance, getSolBalance, isValidSolanaAddress, toRawAmount } from '@solfoundry/sdk';

const connection = createConnection('https://api.mainnet-beta.solana.com');
const wallet = new PublicKey('YourWalletAddress');

const fndry = await getTokenBalance(connection, wallet);
const sol   = await getSolBalance(connection, wallet);

console.log(`${fndry.balance} $FNDRY | ${sol.balanceSol} SOL`);
isValidSolanaAddress('validBase58'); // true
toRawAmount(1.5); // 1500000000n
```

## Real-Time Events

```typescript
import { EventSubscriber } from '@solfoundry/sdk';

const events = new EventSubscriber({ wsUrl: 'wss://api.solfoundry.io/ws', autoReconnect: true });

events.on('bounty_created', e => console.log('New bounty:', e.data.title));
events.onConnect(() => events.subscribe('bounties'));
await events.connect();
```

## Error Handling

```typescript
import { SolFoundry, NotFoundError, RateLimitError, AuthenticationError } from '@solfoundry/sdk';

try {
  const bounty = await client.bounties.get('invalid-id');
} catch (err) {
  if (err instanceof NotFoundError)      console.log('Not found');
  else if (err instanceof RateLimitError) console.log('Rate limited — slow down');
  else if (err instanceof AuthenticationError) console.log('Set SOLFOUNDRY_TOKEN');
  else throw err;
}
```

## API Reference

| Client | Methods |
|--------|---------|
| `client.bounties` | `list`, `get`, `create`, `update`, `delete`, `submitSolution`, `listSubmissions`, `search`, `autocomplete` |
| `client.escrow` | `fund`, `release`, `refund`, `getStatus` |
| `client.contributors` | `list`, `get`, `create`, `update`, `getStats`, `getHealth` |
| `client.api.bounties` | `list`, `get`, `create` |
| `client.api.submissions` | `listForBounty`, `createForBounty` |
| `client.api.users` | `me`, `get`, `updateMe` |
| `GitHubClient` | `listBountyIssues`, `isIssueClaimed`, `isIssueCompleted` |
| `EventSubscriber` | `connect`, `disconnect`, `subscribe`, `on`, `onConnect` |

Full reference: [docs.solfoundry.io/api](https://docs.solfoundry.io/api/)

## Examples

12 working examples in [`sdk/examples/`](./examples/):

| # | File | Description |
|---|------|-------------|
| 01 | [list-bounties.ts](./examples/01-list-bounties.ts) | Paginate and filter bounties |
| 02 | [contributor-stats.ts](./examples/02-contributor-stats.ts) | Reputation, tier, earnings |
| 03 | [realtime-events.ts](./examples/03-realtime-events.ts) | WebSocket event subscriptions |
| 04 | [verify-onchain.ts](./examples/04-verify-onchain.ts) | Solana transaction verification |
| 05 | [leaderboard.ts](./examples/05-leaderboard.ts) | Top contributors |
| 06 | [submit-solution.ts](./examples/06-submit-solution.ts) | Submit a PR to a bounty |
| 07 | [escrow.ts](./examples/07-escrow.ts) | Fund, release, refund |
| 08 | [search-bounties.ts](./examples/08-search-bounties.ts) | Full-text search |
| 09 | [github-integration.ts](./examples/09-github-integration.ts) | GitHub Issues |
| 10 | [solana-helpers.ts](./examples/10-solana-helpers.ts) | On-chain utilities |
| 11 | [error-handling.ts](./examples/11-error-handling.ts) | Typed error patterns |
| 12 | [rest-api-client.ts](./examples/12-rest-api-client.ts) | Typed bounties, submissions, users API clients |

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md).

## License

MIT
