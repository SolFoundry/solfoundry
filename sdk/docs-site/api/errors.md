# Errors

All SDK errors extend `SolFoundryError`.

```typescript
import {
  SolFoundryError,
  AuthenticationError,
  NotFoundError,
  RateLimitError,
  NetworkError,
  RetryExhaustedError,
} from '@solfoundry/sdk';
```

## Hierarchy

```
SolFoundryError
├── AuthenticationError   (HTTP 401)
├── NotFoundError         (HTTP 404)
├── RateLimitError        (HTTP 429)
├── NetworkError          (fetch failed)
└── RetryExhaustedError   (all retries failed)
```

## Properties

All errors expose:
- `.message` — human-readable description
- `.statusCode` — HTTP status code (where applicable)
- `.cause` — underlying error (for `RetryExhaustedError`)

## Example

```typescript
try {
  await client.bounties.get('bad-id');
} catch (err) {
  if (err instanceof NotFoundError) {
    // Handle 404
  } else if (err instanceof RateLimitError) {
    await new Promise(r => setTimeout(r, 1000));
    // retry
  }
}
```
