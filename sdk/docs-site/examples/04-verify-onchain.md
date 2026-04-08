# 04 — Verify On-Chain Completion

Confirm a bounty payout was finalized on the Solana blockchain.

## Via the SDK

```typescript
import { createConnection, PublicKey, getSolBalance, getTokenBalance } from '@solfoundry/sdk';

const connection = createConnection('https://api.mainnet-beta.solana.com');

// Verify recipient received $FNDRY
const recipientWallet = new PublicKey('RecipientWallet...');
const balance = await getTokenBalance(connection, recipientWallet);
console.log(`Recipient FNDRY balance: ${balance.balance}`);
```

## Via the CLI

```bash
solfoundry verify 5KtPn1LGuxhFiw...TxSignature
```

Output:
```
Verification Result
  Signature  5KtPn1LGuxh…
  Status     CONFIRMED ✔
  Slot       298764123
  RPC        https://api.mainnet-beta.solana.com

✔  Transaction is confirmed on-chain. Bounty completion verified.
```

## Via Raw Solana RPC

```typescript
async function verifyTransaction(signature: string): Promise<boolean> {
  const rpcUrl = 'https://api.mainnet-beta.solana.com';

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getSignatureStatuses',
      params: [[signature], { searchTransactionHistory: true }],
    }),
  });

  const { result } = await response.json();
  const status = result?.value?.[0];

  if (!status || status.err) return false;
  return status.confirmationStatus === 'finalized';
}

const isConfirmed = await verifyTransaction('5KtPn1LGuxh...');
console.log('Payout confirmed:', isConfirmed);
```
