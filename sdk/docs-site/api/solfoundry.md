# SolFoundry

Main factory class. The recommended entry point for all SDK usage.

## `SolFoundry.create(config)`

```typescript
static create(config: SolFoundryClientConfig): SolFoundry
```

Creates and returns a configured client with `.bounties`, `.escrow`, and `.contributors` sub-clients.

### Config Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `baseUrl` | `string` | — | **Required.** API base URL |
| `authToken` | `string` | `undefined` | JWT for authenticated requests |
| `maxRetries` | `number` | `3` | Max retry attempts on transient errors |
| `maxRequestsPerSecond` | `number` | `10` | Client-side rate limiting |
| `timeoutMs` | `number` | `30000` | Request timeout in milliseconds |

### Returns

An instance with:
- `.bounties` — [`BountyClient`](/api/bounty-client)
- `.escrow` — [`EscrowClient`](/api/escrow-client)
- `.contributors` — [`ContributorClient`](/api/contributor-client)

### Example

```typescript
import { SolFoundry } from '@solfoundry/sdk';

const client = SolFoundry.create({
  baseUrl: 'https://api.solfoundry.io',
  authToken: process.env.SOLFOUNDRY_TOKEN,
  maxRetries: 3,
  maxRequestsPerSecond: 10,
});
```
