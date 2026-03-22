/**
 * useEscrow — React Query hook for escrow state management and on-chain transactions.
 *
 * Provides:
 * - Escrow account data with automatic polling (real-time balance updates)
 * - Deposit flow: build, sign, send, confirm SPL transfer to escrow PDA
 * - Release flow: owner approves release to contributor wallet
 * - Refund flow: owner reclaims expired/unclaimed escrow funds
 * - Transaction progress tracking with step-by-step UI state
 *
 * Uses React Query for caching, deduplication, and automatic background refetch.
 * @module hooks/useEscrow
 */

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import {
  fetchEscrowAccount,
  recordDeposit,
  recordRelease,
  recordRefund,
} from '../services/escrowService';
import type {
  EscrowAccount,
  EscrowTransactionProgress,
  EscrowTransactionStep,
  INITIAL_TRANSACTION_PROGRESS,
} from '../types/escrow';

/** Query key factory for escrow-related queries to ensure cache consistency. */
export const escrowKeys = {
  /** Base key for all escrow queries. */
  all: ['escrow'] as const,
  /** Key for a specific bounty's escrow account. */
  account: (bountyId: string) => [...escrowKeys.all, 'account', bountyId] as const,
  /** Key for a specific bounty's escrow transaction history. */
  transactions: (bountyId: string) => [...escrowKeys.all, 'transactions', bountyId] as const,
};

/** Polling interval in milliseconds for real-time escrow balance updates. */
const ESCROW_POLL_INTERVAL_MS = 10_000;

/**
 * Build an SPL associated token account creation instruction.
 * Used when the destination ATA does not exist yet.
 *
 * @param payer - Wallet paying for account creation rent.
 * @param associatedTokenAddress - The derived ATA address to create.
 * @param owner - The owner of the new token account.
 * @param mint - The SPL token mint.
 * @returns A TransactionInstruction for creating the ATA.
 */
function buildCreateAtaInstruction(
  payer: PublicKey,
  associatedTokenAddress: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: associatedTokenAddress, isSigner: false, isWritable: true },
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

/**
 * Build an SPL token transfer instruction.
 *
 * @param source - Source token account (ATA of sender).
 * @param destination - Destination token account (ATA of recipient).
 * @param owner - Owner/signer of the source account.
 * @param amount - Amount in raw lamports (bigint).
 * @returns A TransactionInstruction for the SPL transfer.
 */
function buildTransferInstruction(
  source: PublicKey,
  destination: PublicKey,
  owner: PublicKey,
  amount: bigint,
): TransactionInstruction {
  const data = Buffer.alloc(9);
  data.writeUInt8(3, 0);
  data.writeBigUInt64LE(amount, 1);

  return new TransactionInstruction({
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    programId: TOKEN_PROGRAM_ID,
    data,
  });
}

/**
 * Categorize a raw error into a user-friendly message.
 * Handles common wallet and transaction failure scenarios.
 *
 * @param error - The caught error from a transaction attempt.
 * @returns A descriptive error message string.
 */
function categorizeTransactionError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('User rejected') || message.includes('user rejected')) {
    return 'Transaction was rejected in your wallet.';
  }
  if (message.includes('insufficient') || message.includes('Insufficient')) {
    return 'Insufficient $FNDRY balance for this transaction.';
  }
  if (message.includes('timeout') || message.includes('Timeout')) {
    return 'Transaction timed out. The Solana network may be congested.';
  }
  if (message.includes('blockhash')) {
    return 'Transaction expired. Please try again.';
  }
  if (message.includes('not connected') || message.includes('Wallet not connected')) {
    return 'Please connect your wallet to continue.';
  }

  return message || 'An unexpected transaction error occurred.';
}

/** Return type for the useEscrow hook. */
export interface UseEscrowReturn {
  /** The escrow account data, null while loading or if not found. */
  readonly escrowAccount: EscrowAccount | null;
  /** Whether the escrow account query is currently loading. */
  readonly isLoading: boolean;
  /** Error from the escrow account query, null if no error. */
  readonly queryError: string | null;
  /** Current transaction progress state for UI display. */
  readonly transactionProgress: EscrowTransactionProgress;
  /** Initiate a deposit of $FNDRY tokens into the bounty escrow. */
  readonly deposit: (amount: number) => Promise<string>;
  /** Release escrowed funds to the specified contributor wallet. */
  readonly release: (contributorWallet: string) => Promise<string>;
  /** Refund escrowed funds back to the bounty owner. */
  readonly refund: () => Promise<string>;
  /** Reset the transaction progress state back to idle. */
  readonly resetTransaction: () => void;
}

/**
 * Hook for managing escrow state and performing on-chain escrow transactions.
 * Fetches escrow data via React Query with polling for real-time updates.
 * Provides deposit, release, and refund mutation functions.
 *
 * @param bountyId - The bounty whose escrow to manage.
 * @param options - Optional configuration for polling behavior.
 * @returns Escrow state, transaction progress, and mutation functions.
 */
export function useEscrow(
  bountyId: string,
  options?: { pollingEnabled?: boolean },
): UseEscrowReturn {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const queryClient = useQueryClient();

  const pollingEnabled = options?.pollingEnabled ?? true;

  const [transactionProgress, setTransactionProgress] =
    useState<EscrowTransactionProgress>({
      step: 'idle',
      signature: null,
      errorMessage: null,
      operationType: null,
    });

  /** Fetch escrow account with React Query, auto-polling for real-time updates. */
  const {
    data: escrowAccount,
    isLoading,
    error: fetchError,
  } = useQuery({
    queryKey: escrowKeys.account(bountyId),
    queryFn: () => fetchEscrowAccount(bountyId),
    enabled: Boolean(bountyId),
    refetchInterval: pollingEnabled ? ESCROW_POLL_INTERVAL_MS : false,
    staleTime: 5_000,
  });

  const queryError = fetchError
    ? fetchError instanceof Error
      ? fetchError.message
      : 'Failed to fetch escrow data'
    : null;

  /**
   * Update transaction progress state with a new step.
   * Preserves the operation type and existing signature when only the step changes.
   */
  const updateProgress = useCallback(
    (step: EscrowTransactionStep, extra?: Partial<EscrowTransactionProgress>) => {
      setTransactionProgress((prev) => ({
        ...prev,
        step,
        ...extra,
      }));
    },
    [],
  );

  /**
   * Execute an SPL token transfer transaction (deposit to escrow PDA).
   * Handles ATA creation, transaction building, signing, sending, and confirmation.
   *
   * @param amount - Amount of $FNDRY to deposit (display units).
   * @returns The confirmed transaction signature.
   * @throws Error with user-friendly message if any step fails.
   */
  const deposit = useCallback(
    async (amount: number): Promise<string> => {
      if (!publicKey) throw new Error('Wallet not connected');
      if (amount <= 0) throw new Error('Deposit amount must be greater than zero');

      setTransactionProgress({
        step: 'building',
        signature: null,
        errorMessage: null,
        operationType: 'deposit',
      });

      try {
        const rawAmount = BigInt(Math.floor(amount * 10 ** FNDRY_DECIMALS));
        const sourceAta = await findAssociatedTokenAddress(publicKey, FNDRY_TOKEN_MINT);
        const destinationAta = await findAssociatedTokenAddress(ESCROW_WALLET, FNDRY_TOKEN_MINT);

        const transaction = new Transaction();

        // Create destination ATA if it does not exist yet
        const destinationAccountInfo = await connection.getAccountInfo(destinationAta);
        if (!destinationAccountInfo) {
          transaction.add(
            buildCreateAtaInstruction(publicKey, destinationAta, ESCROW_WALLET, FNDRY_TOKEN_MINT),
          );
        }

        transaction.add(
          buildTransferInstruction(sourceAta, destinationAta, publicKey, rawAmount),
        );

        updateProgress('approving');

        const signature = await sendTransaction(transaction, connection);

        updateProgress('confirming', { signature });

        const confirmation = await connection.confirmTransaction(signature, 'confirmed');

        if (confirmation.value.err) {
          throw new Error('Transaction failed on-chain. Please check the explorer for details.');
        }

        // Record in backend and invalidate cache
        try {
          await recordDeposit(bountyId, signature, amount);
        } catch {
          // Backend recording failed but on-chain tx succeeded — non-fatal
          console.warn('Backend deposit recording failed; on-chain tx is confirmed.');
        }

        await queryClient.invalidateQueries({ queryKey: escrowKeys.account(bountyId) });

        updateProgress('confirmed', { signature });
        return signature;
      } catch (error: unknown) {
        const errorMessage = categorizeTransactionError(error);
        setTransactionProgress((prev) => ({
          ...prev,
          step: 'error',
          errorMessage,
        }));
        throw new Error(errorMessage);
      }
    },
    [publicKey, connection, sendTransaction, bountyId, queryClient, updateProgress],
  );

  /**
   * Release escrowed funds to a contributor's wallet.
   * Only the bounty owner can sign this transaction.
   *
   * @param contributorWallet - Base58 wallet address of the contributor.
   * @returns The confirmed transaction signature.
   * @throws Error with user-friendly message if any step fails.
   */
  const release = useCallback(
    async (contributorWallet: string): Promise<string> => {
      if (!publicKey) throw new Error('Wallet not connected');
      if (!contributorWallet) throw new Error('Contributor wallet address is required');

      setTransactionProgress({
        step: 'building',
        signature: null,
        errorMessage: null,
        operationType: 'release',
      });

      try {
        const contributorKey = new PublicKey(contributorWallet);
        const escrowAta = await findAssociatedTokenAddress(ESCROW_WALLET, FNDRY_TOKEN_MINT);
        const contributorAta = await findAssociatedTokenAddress(contributorKey, FNDRY_TOKEN_MINT);

        const lockedAmount = escrowAccount?.lockedAmountRaw
          ? BigInt(escrowAccount.lockedAmountRaw)
          : BigInt(0);

        if (lockedAmount <= BigInt(0)) {
          throw new Error('No funds available in escrow to release');
        }

        const transaction = new Transaction();

        // Create contributor ATA if needed
        const contributorAccountInfo = await connection.getAccountInfo(contributorAta);
        if (!contributorAccountInfo) {
          transaction.add(
            buildCreateAtaInstruction(publicKey, contributorAta, contributorKey, FNDRY_TOKEN_MINT),
          );
        }

        transaction.add(
          buildTransferInstruction(escrowAta, contributorAta, publicKey, lockedAmount),
        );

        updateProgress('approving');

        const signature = await sendTransaction(transaction, connection);

        updateProgress('confirming', { signature });

        const confirmation = await connection.confirmTransaction(signature, 'confirmed');

        if (confirmation.value.err) {
          throw new Error('Release transaction failed on-chain.');
        }

        try {
          await recordRelease(bountyId, signature, contributorWallet);
        } catch {
          console.warn('Backend release recording failed; on-chain tx is confirmed.');
        }

        await queryClient.invalidateQueries({ queryKey: escrowKeys.account(bountyId) });

        updateProgress('confirmed', { signature });
        return signature;
      } catch (error: unknown) {
        const errorMessage = categorizeTransactionError(error);
        setTransactionProgress((prev) => ({
          ...prev,
          step: 'error',
          errorMessage,
        }));
        throw new Error(errorMessage);
      }
    },
    [publicKey, connection, sendTransaction, bountyId, escrowAccount, queryClient, updateProgress],
  );

  /**
   * Refund escrowed funds back to the bounty owner's wallet.
   * Available when the bounty has expired or been cancelled without a winner.
   *
   * @returns The confirmed transaction signature.
   * @throws Error with user-friendly message if any step fails.
   */
  const refund = useCallback(async (): Promise<string> => {
    if (!publicKey) throw new Error('Wallet not connected');

    setTransactionProgress({
      step: 'building',
      signature: null,
      errorMessage: null,
      operationType: 'refund',
    });

    try {
      const escrowAta = await findAssociatedTokenAddress(ESCROW_WALLET, FNDRY_TOKEN_MINT);
      const ownerAta = await findAssociatedTokenAddress(publicKey, FNDRY_TOKEN_MINT);

      const lockedAmount = escrowAccount?.lockedAmountRaw
        ? BigInt(escrowAccount.lockedAmountRaw)
        : BigInt(0);

      if (lockedAmount <= BigInt(0)) {
        throw new Error('No funds available in escrow to refund');
      }

      const transaction = new Transaction();

      transaction.add(
        buildTransferInstruction(escrowAta, ownerAta, publicKey, lockedAmount),
      );

      updateProgress('approving');

      const signature = await sendTransaction(transaction, connection);

      updateProgress('confirming', { signature });

      const confirmation = await connection.confirmTransaction(signature, 'confirmed');

      if (confirmation.value.err) {
        throw new Error('Refund transaction failed on-chain.');
      }

      try {
        await recordRefund(bountyId, signature);
      } catch {
        console.warn('Backend refund recording failed; on-chain tx is confirmed.');
      }

      await queryClient.invalidateQueries({ queryKey: escrowKeys.account(bountyId) });

      updateProgress('confirmed', { signature });
      return signature;
    } catch (error: unknown) {
      const errorMessage = categorizeTransactionError(error);
      setTransactionProgress((prev) => ({
        ...prev,
        step: 'error',
        errorMessage,
      }));
      throw new Error(errorMessage);
    }
  }, [publicKey, connection, sendTransaction, bountyId, escrowAccount, queryClient, updateProgress]);

  /** Reset the transaction progress back to the idle state. */
  const resetTransaction = useCallback(() => {
    setTransactionProgress({
      step: 'idle',
      signature: null,
      errorMessage: null,
      operationType: null,
    });
  }, []);

  return {
    escrowAccount: escrowAccount ?? null,
    isLoading,
    queryError,
    transactionProgress,
    deposit,
    release,
    refund,
    resetTransaction,
  };
}
