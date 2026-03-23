# Error Handling

The SDK exports a typed error hierarchy so you can handle failures precisely.

## Error Classes

| Class | HTTP Status | When |
|-------|-------------|------|
| `SolFoundryError` | — | Base class for all SDK errors |
| `AuthenticationError` | 401 | Missing or invalid JWT |
| `NotFoundError` | 404 | Resource does not exist |
| `RateLimitError` | 429 | Too many requests |
| `NetworkError` | — | Fetch failed (DNS, timeout, ECONNREFUSED) |
| `RetryExhaustedError` | — | All retries failed |

## Usage

```typescript
import {
  SolFoundry,
  NotFoundError,
  AuthenticationError,
  RateLimitError,
  NetworkError,
} from '@solfoundry/sdk';

try {
  const bounty = await client.bounties.get('invalid-uuid');
} catch (error) {
  if (error instanceof NotFoundError) {
    console.log('Bounty not found');
  } else if (error instanceof AuthenticationError) {
    console.log('Please authenticate — set SOLFOUNDRY_TOKEN');
  } else if (error instanceof RateLimitError) {
    console.log('Rate limited — wait a moment and retry');
  } else if (error instanceof NetworkError) {
    console.log('Network issue:', error.message);
  } else {
    throw error; // unexpected, re-throw
  }
}
```

## Retry Behaviour

Transient errors (`NetworkError`, 5xx responses, `RateLimitError`) are automatically retried with exponential backoff up to `maxRetries` (default: 3). You can disable retries with `maxRetries: 0`.
