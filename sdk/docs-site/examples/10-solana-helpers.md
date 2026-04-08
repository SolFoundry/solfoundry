# 10 — Solana Helpers

On-chain utilities: balances, PDAs, address validation, amount conversion.

```typescript
import {
  createConnection,
  PublicKey,
  getTokenBalance,
  getSolBalance,
  findAssociatedTokenAddress,
  isValidSolanaAddress,
  toRawAmount,
  toUiAmount,
} from '@solfoundry/sdk';

const connection = createConnection('https://api.mainnet-beta.solana.com');
const wallet = new PublicKey('YourWalletAddressBase58');

// Get $FNDRY SPL token balance
const fndry = await getTokenBalance(connection, wallet);
console.log(`$FNDRY balance: ${fndry.balance}`);
console.log(`  Raw:     ${fndry.rawAmount}`);   // bigint
console.log(`  Decimals: ${fndry.decimals}`);    // 9

// Get native SOL balance
const sol = await getSolBalance(connection, wallet);
console.log(`SOL balance: ${sol.balanceSol}`);

// Derive associated token account (ATA)
const FNDRY_MINT = new PublicKey('C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS');
const ata = await findAssociatedTokenAddress(wallet, FNDRY_MINT);
console.log(`ATA: ${ata.toBase58()}`);

// Validate addresses
console.log(isValidSolanaAddress('validBase58Address')); // true
console.log(isValidSolanaAddress('not-valid!'));          // false

// Amount conversion (9 decimals for $FNDRY)
const raw = toRawAmount(1.5);     // 1500000000n
const ui  = toUiAmount(raw);      // 1.5
console.log(`1.5 FNDRY = ${raw} raw = ${ui} ui`);
```
