/**
 * Example 10: Solana on-chain helpers.
 *
 * Run: WALLET=<pubkey> npx tsx examples/10-solana-helpers.ts
 */

import {
  createConnection,
  PublicKey,
  getTokenBalance,
  getSolBalance,
  isValidSolanaAddress,
  toRawAmount,
  toUiAmount,
} from '../src/index.js';

const walletStr = process.env.WALLET ?? 'AqqW7hFLau8oH8nDuZp5jPjM3EXUrD7q3SxbcNE8YTN1';

console.log(`Address valid: ${isValidSolanaAddress(walletStr)}`);

const raw1 = toRawAmount(1.5);
const ui1 = toUiAmount(raw1);
console.log(`1.5 FNDRY → ${raw1} raw → ${ui1} ui`);

try {
  const connection = createConnection(process.env.SOLANA_RPC ?? 'https://api.mainnet-beta.solana.com');
  const wallet = new PublicKey(walletStr);

  const sol = await getSolBalance(connection, wallet);
  console.log(`SOL balance:   ${sol.balanceSol}`);

  const fndry = await getTokenBalance(connection, wallet);
  console.log(`$FNDRY balance: ${fndry.balance}`);
} catch (err) {
  console.log('(Skipping live RPC calls — set SOLANA_RPC for real data)');
}
