# MarketplaceApiClient

`MarketplaceApiClient` provides typed REST coverage for marketplace endpoints:

- `client.api.bounties` → `/api/bounties`
- `client.api.submissions` → `/api/bounties/:id/submissions`
- `client.api.users` → `/api/users`

## Usage

```ts
import { SolFoundry } from '@solfoundry/sdk';

const client = SolFoundry.create({ baseUrl: 'https://api.solfoundry.io', authToken: process.env.SOLFOUNDRY_TOKEN });

const bounties = await client.api.bounties.list({ status: 'open', limit: 10 });
const bounty = await client.api.bounties.get(bounties.items[0].id);
const submissions = await client.api.submissions.listForBounty(bounty.id);
const me = await client.api.users.me();
```
