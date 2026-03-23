# Solana Helpers

Utility functions for Solana on-chain interactions.

## Connection

```typescript
import { createConnection } from '@solfoundry/sdk';

const connection = createConnection('https://api.mainnet-beta.solana.com');
```

## Balances

### `getTokenBalance(connection, wallet)`

Returns the $FNDRY SPL token balance.

```typescript
const balance = await getTokenBalance(connection, wallet);
// { balance: 1500.0, rawAmount: 1500000000n, decimals: 9 }
```

### `getSolBalance(connection, wallet)`

Returns the native SOL balance.

```typescript
const sol = await getSolBalance(connection, wallet);
// { balanceSol: 1.5, balanceLamports: 1500000000n }
```

## Address Utilities

### `isValidSolanaAddress(address)`

```typescript
isValidSolanaAddress('base58-address'); // true | false
```

### `findAssociatedTokenAddress(owner, mint)`

Derives the associated token account (ATA) address.

```typescript
const ata = await findAssociatedTokenAddress(ownerPubkey, mintPubkey);
```

## Amount Conversion

```typescript
import { toRawAmount, toUiAmount } from '@solfoundry/sdk';

const raw = toRawAmount(1.5);    // 1500000000n (bigint, 9 decimals)
const ui  = toUiAmount(raw);     // 1.5
```

## PublicKey

```typescript
import { PublicKey } from '@solfoundry/sdk';

const pk = new PublicKey('base58-address');
pk.toBase58(); // 'base58-address'
```
