# Getting Started

Install the SDK and make your first API call in under 5 minutes.

## Prerequisites

- Node.js **18+**
- npm / pnpm / yarn

## Installation

```bash
npm install @solfoundry/sdk
```

## Quick Start

```typescript
import { SolFoundry } from '@solfoundry/sdk';

// 1. Create the client
const client = SolFoundry.create({
  baseUrl: 'https://api.solfoundry.io',
  // authToken is optional for read-only operations
});

// 2. List open bounties
const bounties = await client.bounties.list({ status: 'open', limit: 10 });
console.log(`Found ${bounties.total} open bounties`);

for (const bounty of bounties.bounties) {
  console.log(`  [T${bounty.tier}] ${bounty.title} — ${bounty.reward_amount} $FNDRY`);
}

// 3. Get a specific bounty
const bounty = await client.bounties.get('bounty-uuid');
console.log(bounty.status); // 'open'

// 4. Check contributor stats
const stats = await client.contributors.getStats();
console.log(`${stats.total_contributors} contributors, ${stats.total_bounties_completed} bounties completed`);
```

## Using the CLI

```bash
# One-off usage
npx @solfoundry/cli bounties

# Install globally
npm install -g @solfoundry/cli
solfoundry bounties
solfoundry status <bounty-id>
solfoundry profile <github-username>
solfoundry verify <tx-hash>
```

## Next Steps

- [Configuration](/guide/configuration) — API keys, retries, rate limits
- [Authentication](/guide/authentication) — JWT tokens and wallet auth
- [Examples](/examples/) — 11 working code examples
- [CLI Reference](/guide/cli-commands) — all CLI commands and options
