# Configuration

## Client Options

```typescript
const client = SolFoundry.create({
  // Required: API base URL
  baseUrl: 'https://api.solfoundry.io',

  // Optional: JWT token for authenticated endpoints
  authToken: process.env.SOLFOUNDRY_TOKEN,

  // Retry settings (default: 3 retries with exponential backoff)
  maxRetries: 3,

  // Rate limiting (default: 10 requests/second)
  maxRequestsPerSecond: 10,

  // Request timeout in milliseconds (default: 30000)
  timeoutMs: 30_000,
});
```

## Environment Variables

For the CLI tool:

| Variable | Description | Default |
|----------|-------------|---------|
| `SOLFOUNDRY_BASE_URL` | API base URL | `https://api.solfoundry.io` |
| `SOLFOUNDRY_TOKEN` | JWT auth token | *(none — read-only)* |

```bash
export SOLFOUNDRY_BASE_URL=https://api.solfoundry.io
export SOLFOUNDRY_TOKEN=eyJhbGc...
solfoundry bounties
```

## Pointing to a Local Instance

```typescript
const client = SolFoundry.create({
  baseUrl: 'http://localhost:8000',
});
```
