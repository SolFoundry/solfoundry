# Authentication

Most read operations are public. Mutations (create, update, submit) require a JWT.

## GitHub OAuth

```typescript
// After the OAuth callback you receive a JWT
const client = SolFoundry.create({
  baseUrl: 'https://api.solfoundry.io',
  authToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
});
```

## Wallet-Based Auth (SIWS)

```typescript
import { SolFoundry } from '@solfoundry/sdk';

const publicClient = SolFoundry.create({ baseUrl: 'https://api.solfoundry.io' });

// 1. Get a challenge message
const { message } = await fetch('/api/auth/wallet/message?wallet=<pubkey>').then(r => r.json());

// 2. Sign it with the user's wallet (e.g. Phantom)
const signed = await window.solana.signMessage(new TextEncoder().encode(message));
const signature = btoa(String.fromCharCode(...signed.signature));

// 3. Exchange for a JWT
const { access_token } = await fetch('/api/auth/wallet', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ wallet_address: '<pubkey>', signature, message }),
}).then(r => r.json());

// 4. Build an authenticated client
const authClient = SolFoundry.create({
  baseUrl: 'https://api.solfoundry.io',
  authToken: access_token,
});
```
