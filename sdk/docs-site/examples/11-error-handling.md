# 11 — Error Handling

Typed error patterns for robust integrations.

```typescript
import {
  SolFoundry,
  NotFoundError,
  AuthenticationError,
  RateLimitError,
  NetworkError,
  RetryExhaustedError,
} from '@solfoundry/sdk';

const client = SolFoundry.create({ baseUrl: 'https://api.solfoundry.io' });

// Pattern 1: specific error types
async function getBounty(id: string) {
  try {
    return await client.bounties.get(id);
  } catch (err) {
    if (err instanceof NotFoundError) {
      return null; // expected — bounty was deleted
    }
    throw err;
  }
}

// Pattern 2: exhaustive handling
async function robustFetch(id: string) {
  try {
    return await client.bounties.get(id);
  } catch (err) {
    if (err instanceof AuthenticationError) {
      console.error('Missing SOLFOUNDRY_TOKEN env var');
    } else if (err instanceof NotFoundError) {
      console.error(`Bounty ${id} does not exist`);
    } else if (err instanceof RateLimitError) {
      console.warn('Rate limited — consider reducing maxRequestsPerSecond');
    } else if (err instanceof NetworkError) {
      console.error('Network unreachable:', err.message);
    } else if (err instanceof RetryExhaustedError) {
      console.error('Gave up after retries:', err.cause);
    } else {
      throw err; // unexpected — propagate
    }
    return null;
  }
}

// Pattern 3: check before mutating
async function submitIfOpen(bountyId: string, prUrl: string) {
  const bounty = await getBounty(bountyId);
  if (!bounty) {
    console.log('Bounty not found — skipping');
    return;
  }
  if (bounty.status !== 'open') {
    console.log(`Bounty is ${bounty.status} — not accepting submissions`);
    return;
  }
  return client.bounties.submitSolution(bountyId, { pr_url: prUrl });
}
```
