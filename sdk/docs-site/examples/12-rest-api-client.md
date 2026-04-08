# 12 — Typed REST API Client (Bounties, Submissions, Users)

Use the unified `client.api` surface for strongly-typed marketplace endpoints.

```ts
import { SolFoundry } from '@solfoundry/sdk';

const client = SolFoundry.create({
  baseUrl: 'https://api.solfoundry.io',
  authToken: process.env.SOLFOUNDRY_TOKEN,
});

const bounties = await client.api.bounties.list({ status: 'open', limit: 5, offset: 0 });
const submissions = await client.api.submissions.listForBounty(bounties.items[0].id);
const me = await client.api.users.me();
```

See full source: [`sdk/examples/12-rest-api-client.ts`](https://github.com/SolFoundry/solfoundry/tree/main/sdk/examples/12-rest-api-client.ts)
