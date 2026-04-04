# SolFoundry TypeScript SDK

Production-ready TypeScript SDK for the SolFoundry bounty platform. It provides typed access to bounty management, submissions, users, authentication, retries, and rate-limit-aware request handling.

## Features

- Full API surface for bounties, submissions, and users
- Strong TypeScript definitions with JSDoc on exported APIs
- Dependency-light client built on the standard Fetch API
- Configurable retries with exponential backoff
- Client-side pacing plus `Retry-After` support for rate-limited environments
- Browser and Node.js support

## Installation

```bash
npm install @solfoundry/sdk
```

## Quick Start

```ts
import { SolFoundryClient, SolFoundryError } from "@solfoundry/sdk";

const client = new SolFoundryClient({
  auth: {
    accessToken: process.env.SOLFOUNDRY_ACCESS_TOKEN,
  },
  retry: {
    maxRetries: 3,
  },
  rateLimit: {
    minIntervalMs: 100,
  },
});

async function main(): Promise<void> {
  const bounties = await client.bounties.list({ status: "open", limit: 10 });
  console.log(bounties.items.map((bounty) => bounty.title));
}

main().catch((error) => {
  if (error instanceof SolFoundryError) {
    console.error(error.status, error.problem?.message);
    return;
  }

  throw error;
});
```

## Configuration

```ts
const client = new SolFoundryClient({
  baseUrl: "https://api.solfoundry.com/v1",
  auth: {
    accessToken: process.env.SOLFOUNDRY_ACCESS_TOKEN,
    apiKey: process.env.SOLFOUNDRY_API_KEY,
    getAccessToken: async () => process.env.SOLFOUNDRY_ACCESS_TOKEN,
  },
  headers: {
    "X-App-Version": "my-app/1.0.0",
  },
  timeoutMs: 30_000,
  retry: {
    maxRetries: 4,
    baseDelayMs: 250,
    maxDelayMs: 4_000,
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  },
  rateLimit: {
    minIntervalMs: 100,
    respectRetryAfter: true,
  },
  onResponse: (response, rateLimitState) => {
    console.log(response.status, rateLimitState.remaining);
  },
});
```

## API Coverage

### Bounties

```ts
const created = await client.bounties.create({
  title: "Implement wallet insights API",
  description: "Build and ship the endpoint with tests and docs.",
  reward: { currency: "FNDRY", amount: "900000" },
  status: "open",
  tags: ["backend", "solana"],
});

const list = await client.bounties.list({
  status: "open",
  ownerId: "user_123",
  search: "wallet",
  limit: 20,
});

const updated = await client.bounties.update(created.id, {
  status: "in_review",
});

await client.bounties.delete(created.id);
```

### Submissions

```ts
const submission = await client.submissions.submit({
  bountyId: "bounty_123",
  artifactUrl: "https://github.com/acme/sdk",
  content: "Implementation complete with test coverage.",
});

await client.submissions.review(submission.id, {
  status: "changes_requested",
  comment: "Please add pagination tests.",
});

await client.submissions.approve(submission.id, {
  comment: "Looks good.",
  settlementReference: "payout_456",
});
```

### Users and Authentication

```ts
const session = await client.users.login({
  email: "builder@example.com",
  password: "s3cret",
});

client.setSession(session);

const me = await client.users.getMe();

const refreshed = await client.users.refresh(session.refreshToken!);
client.setSession(refreshed);

await client.users.updateMe({
  displayName: "Aki Builder",
  bio: "Shipping Solana tooling.",
});

await client.users.logout(refreshed.refreshToken);
client.clearSession();
```

## Error Handling

```ts
try {
  await client.bounties.getById("missing-id");
} catch (error) {
  if (error instanceof SolFoundryError) {
    console.error({
      status: error.status,
      code: error.problem?.code,
      message: error.problem?.message,
      rateLimit: error.rateLimit,
    });
  }
}
```

## Documentation

- API guide: [docs/API.md](/Users/akii/.openclaw/workspace/solfoundry-sdk/docs/API.md)
- Main client: [src/client/SolFoundryClient.ts](/Users/akii/.openclaw/workspace/solfoundry-sdk/src/client/SolFoundryClient.ts)
- Exported types: [src/types/index.ts](/Users/akii/.openclaw/workspace/solfoundry-sdk/src/types/index.ts)

## Development

```bash
npm run build
npm run typecheck
```
