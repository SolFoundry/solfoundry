/**
 * Hooks for querying $FNDRY SPL token balance and executing escrow transfers.
 * Uses raw @solana/web3.js — no @solana/spl-token dependency required.
 */
import { useState, useEffect, useCallback } from 'react';
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
  ESCROW_WALLET,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  findAssociatedTokenAddress,
} from '../config/constants';
import type { TransactionStatus, EscrowTransactionState } from '../types/wallet';

/* ── SPL helpers (inline, no external dep) ──────────────────────────────────── */

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

/* ── useFndryBalance ────────────────────────────────────────────────────────── */

interface FndryBalanceState {
  balance: number | null;
  rawBalance: bigint | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/** Query the connected wallet's $FNDRY SPL token balance. */
export function useFndryBalance(): FndryBalanceState {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);
  const [rawBalance, setRawBalance] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!publicKey) {
      setBalance(null);
      setRawBalance(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const accounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        mint: FNDRY_TOKEN_MINT,
      });

      if (accounts.value.length > 0) {
        const info = accounts.value[0].account.data.parsed.info;
        const tokenAmount = info.tokenAmount;
        setBalance(tokenAmount.uiAmount ?? 0);
        setRawBalance(BigInt(tokenAmount.amount));
      } else {
        setBalance(0);
        setRawBalance(BigInt(0));
      }
    } catch {
      setError('Failed to fetch $FNDRY balance');
      setBalance(null);
    } finally {
      setLoading(false);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return { balance, rawBalance, loading, error, refetch: fetchBalance };
}

/* ── useBountyEscrow ────────────────────────────────────────────────────────── */

interface UseBountyEscrowReturn {
  fundBounty: (amount: number) => Promise<string>;
  transaction: EscrowTransactionState;
  reset: () => void;
}

/** Build, sign, send, and confirm an SPL token transfer to the bounty escrow. */
export function useBountyEscrow(): UseBountyEscrowReturn {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [transaction, setTransaction] = useState<EscrowTransactionState>({
    status: 'idle',
    signature: null,
    error: null,
  });

  const reset = useCallback(() => {
    setTransaction({ status: 'idle', signature: null, error: null });
  }, []);

  const fundBounty = useCallback(
    async (amount: number): Promise<string> => {
      if (!publicKey) throw new Error('Wallet not connected');
      if (amount <= 0) throw new Error('Invalid amount');

      setTransaction({ status: 'approving', signature: null, error: null });

      try {
        const rawAmount = BigInt(Math.floor(amount * 10 ** FNDRY_DECIMALS));

        const sourceAta = await findAssociatedTokenAddress(publicKey, FNDRY_TOKEN_MINT);
        const destAta = await findAssociatedTokenAddress(ESCROW_WALLET, FNDRY_TOKEN_MINT);

        const tx = new Transaction();

        // Create escrow ATA if it doesn't exist yet (payer = user)
        const destInfo = await connection.getAccountInfo(destAta);
        if (!destInfo) {
          tx.add(buildCreateAtaInstruction(publicKey, destAta, ESCROW_WALLET, FNDRY_TOKEN_MINT));
        }

        tx.add(buildTransferInstruction(sourceAta, destAta, publicKey, rawAmount));

        setTransaction({ status: 'pending', signature: null, error: null });

        const signature = await sendTransaction(tx, connection);

        setTransaction({ status: 'confirming', signature, error: null });

        const confirmation = await connection.confirmTransaction(signature, 'confirmed');

        if (confirmation.value.err) {
          throw new Error('Transaction failed on-chain');
        }

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

  return { fundBounty, transaction, reset };
}
