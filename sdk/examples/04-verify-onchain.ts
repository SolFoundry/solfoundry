/**
 * Example 04: Verify a Solana transaction is confirmed on-chain.
 *
 * Run: TX=<signature> npx tsx examples/04-verify-onchain.ts
 */

const signature = process.env.TX;
if (!signature) {
  console.error('Set TX=<solana-signature>');
  process.exit(1);
}

const rpcUrl = process.env.SOLANA_RPC ?? 'https://api.mainnet-beta.solana.com';

const resp = await fetch(rpcUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'getSignatureStatuses',
    params: [[signature], { searchTransactionHistory: true }],
  }),
});

const { result } = await resp.json() as { result: { value: Array<{ confirmationStatus: string; err: unknown; slot: number } | null> } };
const status = result?.value?.[0];

if (!status) {
  console.log('Transaction not found.');
  process.exit(1);
}

if (status.err) {
  console.error('Transaction failed on-chain:', status.err);
  process.exit(1);
}

console.log(`✅ Confirmed at slot ${status.slot} (${status.confirmationStatus})`);
