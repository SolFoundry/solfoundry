# @solfoundry/sdk

> Official TypeScript SDK for [SolFoundry](https://solfoundry.io) — the on-chain bounty platform for Solana.

[![npm version](https://img.shields.io/npm/v/@solfoundry/sdk)](https://www.npmjs.com/package/@solfoundry/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Features

- 🔍 **Browse bounties** — filter by status, tier, tags, full-text search
- 👥 **Explore contributors** — leaderboard, profiles, reputation scores
- 📤 **Submit work** — post your PR to claim rewards
- 🔒 **Type-safe** — full TypeScript types, strict mode
- 🌐 **Zero dependencies** — pure `fetch`, works in Node ≥ 18, Deno, Bun, and browsers
- 🖥️ **CLI included** — `solfoundry bounties list` from your terminal

---

## Installation

```bash
npm install @solfoundry/sdk
# or
pnpm add @solfoundry/sdk
# or
yarn add @solfoundry/sdk
```

## Quick Start

```ts
import { SolFoundryClient } from '@solfoundry/sdk';

const client = new SolFoundryClient({
  apiKey: process.env.SOLFOUNDRY_API_KEY, // optional for read-only
});

// List open T2 bounties
const bounties = await client.getBounties({ status: 'open', tier: 'T2' });
console.log(bounties.data);

// Get a specific bounty
const bounty = await client.getBounty('603');
console.log(bounty.title, bounty.reward);

// List top contributors
const contributors = await client.getContributors({ pageSize: 10 });
console.log(contributors.data);

// Submit your PR (requires API key)
const submission = await client.submitWork({
  bountyId: bounty.id,
  prUrl: 'https://github.com/SolFoundry/solfoundry/pull/999',
});
console.log(submission.status); // 'pending'
```

## API Reference

### `new SolFoundryClient(config?)`

| Option    | Type     | Default                       | Description                    |
|-----------|----------|-------------------------------|--------------------------------|
| `baseUrl` | `string` | `https://api.solfoundry.io`   | API base URL                   |
| `apiKey`  | `string` | —                             | Bearer token for write access  |
| `timeout` | `number` | `10000`                       | Request timeout (ms)           |
| `fetch`   | `fetch`  | `globalThis.fetch`            | Custom fetch implementation    |

### Methods

#### `getBounties(filter?)` → `PaginatedResponse<Bounty>`
Fetch a paginated list of bounties.

```ts
const page = await client.getBounties({
  status: 'open',
  tier: 'T3',
  tags: ['typescript', 'react'],
  page: 1,
  pageSize: 20,
  search: 'analytics',
});
```

#### `getBounty(id)` → `Bounty`
Fetch a single bounty by ID or GitHub issue number.

```ts
const bounty = await client.getBounty('602');
```

#### `getContributors(filter?)` → `PaginatedResponse<Contributor>`
Fetch contributors with optional filtering.

```ts
const leaders = await client.getContributors({ minReputation: 100 });
```

#### `getContributor(handle)` → `Contributor`
Fetch a contributor by GitHub handle.

```ts
const alice = await client.getContributor('alice');
```

#### `submitWork(params)` → `WorkSubmission`
Submit a PR for a bounty claim. Requires `apiKey`.

```ts
const sub = await client.submitWork({
  bountyId: '602',
  prUrl: 'https://github.com/SolFoundry/solfoundry/pull/999',
  notes: 'Fully implemented, all tests pass.',
});
```

#### `getBountySubmissions(bountyId)` → `WorkSubmission[]`
Fetch all submissions for a bounty.

#### `getMySubmissions()` → `WorkSubmission[]`
Fetch your own submissions (requires API key).

---

## CLI

```bash
# Install globally
npm install -g @solfoundry/cli

# List open bounties
solfoundry bounties list --status open

# Filter by tier
solfoundry bounties list --tier T3

# Get a single bounty
solfoundry bounty get 602

# List contributors
solfoundry contributors list

# Get a contributor
solfoundry contributor get alice
```

### Environment Variables

| Variable              | Description                        |
|-----------------------|------------------------------------|
| `SOLFOUNDRY_API_KEY`  | API key for authenticated requests |
| `SOLFOUNDRY_API_URL`  | Override API base URL              |

---

## Error Handling

```ts
import { SolFoundryClient, SolFoundryError } from '@solfoundry/sdk';

try {
  const bounty = await client.getBounty('nonexistent');
} catch (err) {
  if (err instanceof SolFoundryError) {
    console.error(err.message);      // human-readable message
    console.error(err.statusCode);   // HTTP status code (e.g. 404)
    console.error(err.code);         // machine-readable code (e.g. 'NOT_FOUND')
  }
}
```

---

## Development

```bash
cd sdk
npm install
npm run build
npm run typecheck
```

## License

MIT © SolFoundry
