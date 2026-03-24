/**
 * useStaking — wallet transaction hook for stake and unstake-complete flows.
 * Builds, signs, sends, and confirms SPL token transfers to the staking wallet.
 * Uses the same raw web3.js pattern as useFndryToken (no @solana/spl-token).
 */
import { useState, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import {
  FNDRY_TOKEN_MINT,
  FNDRY_DECIMALS,
  STAKING_WALLET,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  findAssociatedTokenAddress,
} from '../config/constants';
import type { TransactionStatus } from '../types/wallet';

/* ── SPL helpers (mirrored from useFndryToken) ──────────────────────────── */

function buildCreateAtaInstruction(
  payer: PublicKey,
  ata: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: ata, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    data: Buffer.alloc(0),
  });
}

function buildTransferInstruction(
  source: PublicKey,
  dest: PublicKey,
  owner: PublicKey,
  amount: bigint,
): TransactionInstruction {
  const data = Buffer.alloc(9);
  data.writeUInt8(3, 0);
  data.writeBigUInt64LE(amount, 1);
  return new TransactionInstruction({
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: dest, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    programId: TOKEN_PROGRAM_ID,
    data,
  });
}

/* ── Types ───────────────────────────────────────────────────────────────── */

export interface StakingTxState {
  status: TransactionStatus;
  signature: string | null;
  error: string | null;
}

export interface UseStakingTxReturn {
  stakeTokens: (amount: number) => Promise<string>;
  unstakeTokens: (amount: number) => Promise<string>;
  transaction: StakingTxState;
  reset: () => void;
}

/* ── Hook ────────────────────────────────────────────────────────────────── */

export function useStakingTx(): UseStakingTxReturn {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [transaction, setTransaction] = useState<StakingTxState>({
    status: 'idle',
    signature: null,
    error: null,
  });

  const reset = useCallback(() => {
    setTransaction({ status: 'idle', signature: null, error: null });
  }, []);

  const _executeTransfer = useCallback(
    async (amount: number, destination: PublicKey): Promise<string> => {
      if (!publicKey) throw new Error('Wallet not connected');
      if (amount <= 0) throw new Error('Invalid amount');

      setTransaction({ status: 'approving', signature: null, error: null });

      try {
        const rawAmount = BigInt(Math.floor(amount * 10 ** FNDRY_DECIMALS));
        const sourceAta = await findAssociatedTokenAddress(publicKey, FNDRY_TOKEN_MINT);
        const destAta = await findAssociatedTokenAddress(destination, FNDRY_TOKEN_MINT);

        const tx = new Transaction();

        const destInfo = await connection.getAccountInfo(destAta);
        if (!destInfo) {
          tx.add(buildCreateAtaInstruction(publicKey, destAta, destination, FNDRY_TOKEN_MINT));
        }
        tx.add(buildTransferInstruction(sourceAta, destAta, publicKey, rawAmount));

        setTransaction({ status: 'pending', signature: null, error: null });
        const signature = await sendTransaction(tx, connection);
        setTransaction({ status: 'confirming', signature, error: null });

        const confirmation = await connection.confirmTransaction(signature, 'confirmed');
        if (confirmation.value.err) throw new Error('Transaction failed on-chain');

        setTransaction({ status: 'confirmed', signature, error: null });
        return signature;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Transaction failed';
        const errorMessage = msg.includes('User rejected')
          ? 'Transaction rejected by wallet'
          : msg.includes('insufficient')
            ? 'Insufficient $FNDRY balance'
            : msg;
        setTransaction((prev) => ({
          status: 'error' as TransactionStatus,
          signature: prev.signature,
          error: errorMessage,
        }));
        throw new Error(errorMessage);
      }
    },
    [connection, publicKey, sendTransaction],
  );

  const stakeTokens = useCallback(
    (amount: number) => _executeTransfer(amount, STAKING_WALLET),
    [_executeTransfer],
  );

  // Unstake reclaims from staking wallet → user wallet (reverse direction)
  const unstakeTokens = useCallback(
    async (amount: number): Promise<string> => {
      // The on-chain unstake is signed server-side via the staking program.
      // We send a 0-lamport memo transaction so the wallet still signs,
      // providing the user a confirmation UX. The actual token movement
      // is handled by the backend after cooldown expires.
      if (!publicKey) throw new Error('Wallet not connected');
      setTransaction({ status: 'approving', signature: null, error: null });
      try {
        const { SystemProgram: SP } = await import('@solana/web3.js');
        const tx = new Transaction().add(
          SP.transfer({ fromPubkey: publicKey, toPubkey: publicKey, lamports: 0 }),
        );
        setTransaction({ status: 'pending', signature: null, error: null });
        const signature = await sendTransaction(tx, connection);
        setTransaction({ status: 'confirming', signature, error: null });
        const conf = await connection.confirmTransaction(signature, 'confirmed');
        if (conf.value.err) throw new Error('Transaction failed on-chain');
        setTransaction({ status: 'confirmed', signature, error: null });
        return signature;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Transaction failed';
        const errorMessage = msg.includes('User rejected') ? 'Transaction rejected by wallet' : msg;
        setTransaction((prev) => ({
          status: 'error' as TransactionStatus,
          signature: prev.signature,
          error: errorMessage,
        }));
        throw new Error(errorMessage);
      }
    },
    [connection, publicKey, sendTransaction],
  );

  return { stakeTokens, unstakeTokens, transaction, reset };
}
