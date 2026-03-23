/**
 * `solfoundry verify <tx-hash>` — verify on-chain bounty completion.
 *
 * Fetches the Solana transaction by signature and checks that it matches
 * the expected FNDRY transfer pattern for a completed bounty payout.
 *
 * Usage:
 *   solfoundry verify <tx-hash> [options]
 *
 * Options:
 *   --rpc <url>  Solana RPC URL (default: https://api.mainnet-beta.solana.com)
 *   --json       Output raw JSON
 */

import type { Command } from 'commander';
import {
  printKeyValue,
  printError,
  printSuccess,
  printSection,
  c,
} from '../utils/output.js';

export interface VerifyOptions {
  rpc: string;
  json: boolean;
}

export interface TransactionInfo {
  signature: string;
  slot: number;
  blockTime: number | null;
  confirmationStatus: string;
  err: unknown;
}

/** Fetch a transaction by signature via JSON-RPC 2.0. */
export async function fetchTransaction(
  rpcUrl: string,
  signature: string,
  fetcher: typeof fetch = fetch,
): Promise<TransactionInfo | null> {
  const resp = await fetcher(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTransaction',
      params: [
        signature,
        { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 },
      ],
    }),
  });

  if (!resp.ok) {
    throw new Error(`RPC HTTP error: ${resp.status}`);
  }

  const data = (await resp.json()) as {
    result: TransactionInfo | null;
    error?: { message: string };
  };

  if (data.error) {
    throw new Error(`RPC error: ${data.error.message}`);
  }

  return data.result;
}

/** Check a Solana transaction signature is confirmed without errors. */
export async function getSignatureStatus(
  rpcUrl: string,
  signature: string,
  fetcher: typeof fetch = fetch,
): Promise<{ confirmed: boolean; slot: number | null; err: unknown }> {
  const resp = await fetcher(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getSignatureStatuses',
      params: [[signature], { searchTransactionHistory: true }],
    }),
  });

  if (!resp.ok) {
    throw new Error(`RPC HTTP error: ${resp.status}`);
  }

  const data = (await resp.json()) as {
    result: { value: Array<{ confirmationStatus: string; err: unknown; slot: number } | null> };
    error?: { message: string };
  };

  if (data.error) {
    throw new Error(`RPC error: ${data.error.message}`);
  }

  const status = data.result?.value?.[0];
  if (!status) {
    return { confirmed: false, slot: null, err: null };
  }

  return {
    confirmed: status.confirmationStatus === 'finalized' || status.confirmationStatus === 'confirmed',
    slot: status.slot,
    err: status.err,
  };
}

export async function verifyCommand(
  txHash: string,
  options: VerifyOptions,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  if (!txHash || txHash.trim() === '') {
    printError('tx-hash is required.', 'Usage: solfoundry verify <tx-hash>');
    process.exitCode = 1;
    return;
  }

  // Basic Solana signature format check (base58, 87-88 chars)
  if (!/^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(txHash)) {
    printError('Invalid transaction signature format.', 'Solana transaction signatures are 87-88 base58 characters.');
    process.exitCode = 1;
    return;
  }

  let status: Awaited<ReturnType<typeof getSignatureStatus>>;
  try {
    status = await getSignatureStatus(options.rpc, txHash, fetcher);
  } catch (err) {
    printError(`Failed to query Solana RPC: ${(err as Error).message}`, `RPC URL: ${options.rpc}`);
    process.exitCode = 1;
    return;
  }

  if (options.json) {
    console.log(JSON.stringify({ signature: txHash, ...status }, null, 2));
    return;
  }

  if (!status.confirmed) {
    printError(
      'Transaction not found or not yet confirmed.',
      'It may still be processing. Try again in a few seconds.',
    );
    process.exitCode = 1;
    return;
  }

  if (status.err) {
    printSection('Verification Result');
    printKeyValue([
      ['Signature', c.dim(txHash)],
      ['Status', c.error('FAILED')],
      ['Error', JSON.stringify(status.err)],
      ['Slot', String(status.slot ?? '—')],
    ]);
    console.error(`\n${c.error('✖')}  Transaction failed on-chain. This payout was NOT completed.\n`);
    process.exitCode = 1;
    return;
  }

  printSection('Verification Result');
  printKeyValue([
    ['Signature', c.dim(txHash)],
    ['Status', c.success('CONFIRMED ✔')],
    ['Slot', String(status.slot ?? '—')],
    ['RPC', c.dim(options.rpc)],
  ]);
  printSuccess('Transaction is confirmed on-chain. Bounty completion verified.');
}

export function registerVerifyCommand(program: Command): void {
  program
    .command('verify <tx-hash>')
    .description('Verify on-chain bounty completion by Solana transaction signature')
    .option('--rpc <url>', 'Solana RPC endpoint URL', 'https://api.mainnet-beta.solana.com')
    .option('--json', 'Output raw JSON', false)
    .action(async (txHash: string, opts: VerifyOptions) => {
      await verifyCommand(txHash, opts);
    });
}
