/**
 * useEscrow — React Query hook for escrow state management and Anchor program transactions.
 *
 * Provides:
 * - Escrow account data with automatic polling and WebSocket real-time balance updates
 * - Deposit flow: build Anchor deposit instruction, sign, send, confirm
 * - Release flow: Anchor program-mediated release to contributor via escrow PDA
 * - Refund flow: Anchor program-mediated refund to owner via escrow PDA
 * - Transaction progress tracking with full step-by-step UI state (including 'sending')
 * - Automatic transaction history and account cache invalidation
 *
 * Uses React Query for caching, deduplication, and automatic background refetch.
 * All escrow operations go through the Anchor escrow program — the program's PDA
 * authority signs release/refund instructions, not the user's wallet directly.
 *
 * @module hooks/useEscrow
 */

import { useState, useCallback, useEffect, useRef } from 'react';
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
  ESCROW_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  deriveEscrowPda,
  findAssociatedTokenAddress,
} from '../config/constants';
import {
  fetchEscrowAccount,
  fetchEscrowTransactions,
  recordDeposit,
  recordRelease,
  recordRefund,
} from '../services/escrowService';
import type {
  EscrowAccount,
  EscrowTransaction,
  EscrowTransactionProgress,
  EscrowTransactionStep,
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

/** Maximum number of retry attempts for failed transactions. */
const MAX_RETRY_ATTEMPTS = 3;

/** Base delay in milliseconds for exponential backoff between retries. */
const RETRY_BASE_DELAY_MS = 1_000;

/**
 * Anchor instruction discriminator for the deposit instruction.
 * First 8 bytes of sha256("global:deposit").
 */
const DEPOSIT_DISCRIMINATOR = Buffer.from([242, 35, 198, 137, 82, 225, 242, 182]);

/**
 * Anchor instruction discriminator for the release instruction.
 * First 8 bytes of sha256("global:release").
 */
const RELEASE_DISCRIMINATOR = Buffer.from([195, 7, 76, 181, 108, 134, 155, 218]);

/**
 * Anchor instruction discriminator for the refund instruction.
 * First 8 bytes of sha256("global:refund").
 */
const REFUND_DISCRIMINATOR = Buffer.from([2, 96, 183, 251, 63, 208, 46, 46]);

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
 * Build an Anchor escrow deposit instruction.
 * Deposits $FNDRY from the user's ATA to the escrow PDA's ATA.
 * The escrow program validates the deposit and updates the escrow state.
 *
 * @param depositor - The wallet initiating the deposit (signer).
 * @param escrowPda - The derived escrow PDA for the bounty.
 * @param depositorAta - The depositor's associated token account.
 * @param escrowAta - The escrow PDA's associated token account.
 * @param amount - The amount to deposit in raw lamports (bigint).
 * @returns A TransactionInstruction for the Anchor deposit.
 */
function buildEscrowDepositInstruction(
  depositor: PublicKey,
  escrowPda: PublicKey,
  depositorAta: PublicKey,
  escrowAta: PublicKey,
  amount: bigint,
): TransactionInstruction {
  const data = Buffer.alloc(16);
  DEPOSIT_DISCRIMINATOR.copy(data, 0);
  data.writeBigUInt64LE(amount, 8);

  return new TransactionInstruction({
    keys: [
      { pubkey: depositor, isSigner: true, isWritable: true },
      { pubkey: escrowPda, isSigner: false, isWritable: true },
      { pubkey: depositorAta, isSigner: false, isWritable: true },
      { pubkey: escrowAta, isSigner: false, isWritable: true },
      { pubkey: FNDRY_TOKEN_MINT, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: ESCROW_PROGRAM_ID,
    data,
  });
}

/**
 * Build an Anchor escrow release instruction.
 * Releases $FNDRY from the escrow PDA to the contributor's wallet.
 * The escrow program's PDA authority signs the transfer — the owner only
 * authorizes the instruction, not the actual token transfer.
 *
 * @param owner - The bounty owner authorizing the release (signer).
 * @param escrowPda - The derived escrow PDA for the bounty.
 * @param escrowAta - The escrow PDA's associated token account.
 * @param contributorAta - The contributor's associated token account.
 * @param contributor - The contributor's wallet public key.
 * @param escrowBump - The PDA bump seed for the escrow account.
 * @returns A TransactionInstruction for the Anchor release.
 */
function buildEscrowReleaseInstruction(
  owner: PublicKey,
  escrowPda: PublicKey,
  escrowAta: PublicKey,
  contributorAta: PublicKey,
  contributor: PublicKey,
  escrowBump: number,
): TransactionInstruction {
  const data = Buffer.alloc(9);
  RELEASE_DISCRIMINATOR.copy(data, 0);
  data.writeUInt8(escrowBump, 8);

  return new TransactionInstruction({
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: escrowPda, isSigner: false, isWritable: true },
      { pubkey: escrowAta, isSigner: false, isWritable: true },
      { pubkey: contributorAta, isSigner: false, isWritable: true },
      { pubkey: contributor, isSigner: false, isWritable: false },
      { pubkey: FNDRY_TOKEN_MINT, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId: ESCROW_PROGRAM_ID,
    data,
  });
}

/**
 * Build an Anchor escrow refund instruction.
 * Refunds $FNDRY from the escrow PDA back to the owner's wallet.
 * The escrow program validates expiry/cancellation and its PDA authority
 * signs the token transfer.
 *
 * @param owner - The bounty owner requesting the refund (signer).
 * @param escrowPda - The derived escrow PDA for the bounty.
 * @param escrowAta - The escrow PDA's associated token account.
 * @param ownerAta - The owner's associated token account.
 * @param escrowBump - The PDA bump seed for the escrow account.
 * @returns A TransactionInstruction for the Anchor refund.
 */
function buildEscrowRefundInstruction(
  owner: PublicKey,
  escrowPda: PublicKey,
  escrowAta: PublicKey,
  ownerAta: PublicKey,
  escrowBump: number,
): TransactionInstruction {
  const data = Buffer.alloc(9);
  REFUND_DISCRIMINATOR.copy(data, 0);
  data.writeUInt8(escrowBump, 8);

  return new TransactionInstruction({
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: escrowPda, isSigner: false, isWritable: true },
      { pubkey: escrowAta, isSigner: false, isWritable: true },
      { pubkey: ownerAta, isSigner: false, isWritable: true },
      { pubkey: FNDRY_TOKEN_MINT, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId: ESCROW_PROGRAM_ID,
    data,
  });
}

/**
 * Categorize a raw error into a user-friendly message.
 * Handles common wallet adapter, Solana RPC, and transaction failure scenarios
 * with specific messages for each error type.
 *
 * @param error - The caught error from a transaction attempt.
 * @returns A descriptive error message string.
 */
function categorizeTransactionError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('User rejected') || message.includes('user rejected')) {
    return 'Transaction was rejected in your wallet. No funds were moved.';
  }
  if (message.includes('insufficient') || message.includes('Insufficient')) {
    return 'Insufficient $FNDRY balance for this transaction. Please add more tokens.';
  }
  if (message.includes('timeout') || message.includes('Timeout') || message.includes('timed out')) {
    return 'Transaction timed out. The Solana network may be congested — please try again.';
  }
  if (message.includes('blockhash') || message.includes('BlockhashNotFound')) {
    return 'Transaction expired due to blockhash expiry. Please try again.';
  }
  if (message.includes('not connected') || message.includes('Wallet not connected')) {
    return 'Please connect your wallet to continue.';
  }
  if (message.includes('already been processed') || message.includes('AlreadyProcessed')) {
    return 'This transaction has already been processed.';
  }
  if (message.includes('custom program error') || message.includes('InstructionError')) {
    return 'The escrow program rejected this transaction. Please check your permissions and try again.';
  }

  return message || 'An unexpected transaction error occurred. Please try again.';
}

/**
 * Calculate exponential backoff delay with jitter for retry logic.
 *
 * @param attempt - The current retry attempt number (0-indexed).
 * @returns Delay in milliseconds before the next retry.
 */
function calculateRetryDelay(attempt: number): number {
  const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
  const jitter = Math.random() * delay * 0.5;
  return delay + jitter;
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
  /** The escrow transaction history for this bounty. */
  readonly transactions: EscrowTransaction[];
  /** Whether the transaction history is loading. */
  readonly transactionsLoading: boolean;
  /** Whether WebSocket real-time updates are active. */
  readonly isRealtimeConnected: boolean;
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
 * Hook for managing escrow state and performing on-chain Anchor escrow transactions.
 * Fetches escrow data via React Query with polling and optional WebSocket for real-time updates.
 * Provides deposit, release, and refund mutation functions that interact with the
 * SolFoundry Escrow Anchor program using per-bounty PDA accounts.
 *
 * @param bountyId - The bounty whose escrow to manage.
 * @param options - Optional configuration for polling and real-time behavior.
 * @returns Escrow state, transaction progress, transaction history, and mutation functions.
 */
export function useEscrow(
  bountyId: string,
  options?: { pollingEnabled?: boolean; realtimeEnabled?: boolean },
): UseEscrowReturn {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const queryClient = useQueryClient();

  const pollingEnabled = options?.pollingEnabled ?? true;
  const realtimeEnabled = options?.realtimeEnabled ?? true;
  const websocketRef = useRef<WebSocket | null>(null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

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

  /** Fetch transaction history for the escrow account. */
  const {
    data: transactions,
    isLoading: transactionsLoading,
  } = useQuery({
    queryKey: escrowKeys.transactions(bountyId),
    queryFn: () => fetchEscrowTransactions(bountyId),
    enabled: Boolean(bountyId),
    staleTime: 10_000,
  });

  /**
   * WebSocket connection for real-time escrow balance updates.
   * Subscribes to the escrow PDA's account changes on the Solana cluster.
   * Falls back to polling when WebSocket is unavailable.
   */
  useEffect(() => {
    if (!realtimeEnabled || !bountyId) return;

    let cancelled = false;

    async function setupWebSocket(): Promise<void> {
      try {
        const [escrowPda] = await deriveEscrowPda(bountyId);
        const escrowAta = await findAssociatedTokenAddress(escrowPda, FNDRY_TOKEN_MINT);

        const subscriptionId = connection.onAccountChange(
          escrowAta,
          () => {
            if (!cancelled) {
              queryClient.invalidateQueries({ queryKey: escrowKeys.account(bountyId) });
              queryClient.invalidateQueries({ queryKey: escrowKeys.transactions(bountyId) });
            }
          },
          'confirmed',
        );

        if (!cancelled) {
          setIsRealtimeConnected(true);
        }

        /** Store the subscription ID for cleanup. */
        websocketRef.current = { close: () => connection.removeAccountChangeListener(subscriptionId) } as unknown as WebSocket;
      } catch {
        /** WebSocket setup failed — polling remains active as fallback. */
        if (!cancelled) {
          setIsRealtimeConnected(false);
        }
      }
    }

    setupWebSocket();

    return () => {
      cancelled = true;
      setIsRealtimeConnected(false);
      if (websocketRef.current) {
        websocketRef.current.close();
        websocketRef.current = null;
      }
    };
  }, [bountyId, connection, queryClient, realtimeEnabled]);

  const queryError = fetchError
    ? fetchError instanceof Error
      ? fetchError.message
      : 'Failed to fetch escrow data'
    : null;

  /**
   * Update transaction progress state with a new step.
   * Preserves the operation type and existing signature when only the step changes.
   *
   * @param step - The new transaction step to set.
   * @param extra - Optional additional fields to merge into the progress state.
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
   * Invalidate all escrow-related queries for the current bounty.
   * Called after successful transactions to refresh both account data
   * and transaction history in the cache.
   */
  const invalidateEscrowQueries = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: escrowKeys.account(bountyId) }),
      queryClient.invalidateQueries({ queryKey: escrowKeys.transactions(bountyId) }),
    ]);
  }, [queryClient, bountyId]);

  /**
   * Execute an Anchor escrow deposit transaction.
   * Derives the per-bounty escrow PDA, builds the deposit instruction,
   * handles ATA creation, signing, sending, and confirmation.
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

        /** Derive the per-bounty escrow PDA and its ATA. */
        const [escrowPda] = await deriveEscrowPda(bountyId);
        const depositorAta = await findAssociatedTokenAddress(publicKey, FNDRY_TOKEN_MINT);
        const escrowAta = await findAssociatedTokenAddress(escrowPda, FNDRY_TOKEN_MINT);

        const transaction = new Transaction();

        /** Create escrow ATA if it does not exist yet (payer = depositor). */
        const escrowAtaInfo = await connection.getAccountInfo(escrowAta);
        if (!escrowAtaInfo) {
          transaction.add(
            buildCreateAtaInstruction(publicKey, escrowAta, escrowPda, FNDRY_TOKEN_MINT),
          );
        }

        /** Add the Anchor deposit instruction. */
        transaction.add(
          buildEscrowDepositInstruction(
            publicKey,
            escrowPda,
            depositorAta,
            escrowAta,
            rawAmount,
          ),
        );

        updateProgress('approving');

        const signature = await sendTransaction(transaction, connection);

        updateProgress('sending', { signature });

        updateProgress('confirming', { signature });

        const confirmation = await connection.confirmTransaction(signature, 'confirmed');

        if (confirmation.value.err) {
          throw new Error('Deposit transaction failed on-chain. Please check the explorer for details.');
        }

        /** Record the deposit in the backend (non-fatal if it fails). */
        try {
          await recordDeposit(bountyId, signature, amount);
        } catch {
          console.warn('Backend deposit recording failed; on-chain transaction is confirmed.');
        }

        await invalidateEscrowQueries();

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
    [publicKey, connection, sendTransaction, bountyId, updateProgress, invalidateEscrowQueries],
  );

  /**
   * Release escrowed funds to a contributor's wallet via the Anchor escrow program.
   * The escrow program's PDA authority signs the SPL token transfer —
   * the connected wallet (bounty owner) only authorizes the instruction.
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

        /** Derive the per-bounty escrow PDA and its ATA. */
        const [escrowPda, escrowBump] = await deriveEscrowPda(bountyId);
        const escrowAta = await findAssociatedTokenAddress(escrowPda, FNDRY_TOKEN_MINT);
        const contributorAta = await findAssociatedTokenAddress(contributorKey, FNDRY_TOKEN_MINT);

        const lockedAmount = escrowAccount?.lockedAmountRaw
          ? BigInt(escrowAccount.lockedAmountRaw)
          : BigInt(0);

        if (lockedAmount <= BigInt(0)) {
          throw new Error('No funds available in escrow to release');
        }

        const transaction = new Transaction();

        /** Create contributor ATA if needed (payer = owner). */
        const contributorAccountInfo = await connection.getAccountInfo(contributorAta);
        if (!contributorAccountInfo) {
          transaction.add(
            buildCreateAtaInstruction(publicKey, contributorAta, contributorKey, FNDRY_TOKEN_MINT),
          );
        }

        /**
         * Add the Anchor release instruction.
         * The escrow program's PDA authority signs the token transfer,
         * so the owner's wallet only needs to authorize the instruction.
         */
        transaction.add(
          buildEscrowReleaseInstruction(
            publicKey,
            escrowPda,
            escrowAta,
            contributorAta,
            contributorKey,
            escrowBump,
          ),
        );

        updateProgress('approving');

        const signature = await sendTransaction(transaction, connection);

        updateProgress('sending', { signature });

        updateProgress('confirming', { signature });

        const confirmation = await connection.confirmTransaction(signature, 'confirmed');

        if (confirmation.value.err) {
          throw new Error('Release transaction failed on-chain. Check the explorer for details.');
        }

        /** Record the release in the backend (non-fatal if it fails). */
        try {
          await recordRelease(bountyId, signature, contributorWallet);
        } catch {
          console.warn('Backend release recording failed; on-chain transaction is confirmed.');
        }

        await invalidateEscrowQueries();

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
    [publicKey, connection, sendTransaction, bountyId, escrowAccount, updateProgress, invalidateEscrowQueries],
  );

  /**
   * Refund escrowed funds back to the bounty owner's wallet via the Anchor escrow program.
   * Available when the bounty has expired or been cancelled without a winner.
   * The escrow program validates eligibility and its PDA authority signs the transfer.
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
      /** Derive the per-bounty escrow PDA and its ATA. */
      const [escrowPda, escrowBump] = await deriveEscrowPda(bountyId);
      const escrowAta = await findAssociatedTokenAddress(escrowPda, FNDRY_TOKEN_MINT);
      const ownerAta = await findAssociatedTokenAddress(publicKey, FNDRY_TOKEN_MINT);

      const lockedAmount = escrowAccount?.lockedAmountRaw
        ? BigInt(escrowAccount.lockedAmountRaw)
        : BigInt(0);

      if (lockedAmount <= BigInt(0)) {
        throw new Error('No funds available in escrow to refund');
      }

      const transaction = new Transaction();

      /**
       * Add the Anchor refund instruction.
       * The escrow program validates the refund eligibility (expired/cancelled)
       * and its PDA authority signs the token transfer back to the owner.
       */
      transaction.add(
        buildEscrowRefundInstruction(
          publicKey,
          escrowPda,
          escrowAta,
          ownerAta,
          escrowBump,
        ),
      );

      updateProgress('approving');

      const signature = await sendTransaction(transaction, connection);

      updateProgress('sending', { signature });

      updateProgress('confirming', { signature });

      const confirmation = await connection.confirmTransaction(signature, 'confirmed');

      if (confirmation.value.err) {
        throw new Error('Refund transaction failed on-chain. Check the explorer for details.');
      }

      /** Record the refund in the backend (non-fatal if it fails). */
      try {
        await recordRefund(bountyId, signature);
      } catch {
        console.warn('Backend refund recording failed; on-chain transaction is confirmed.');
      }

      await invalidateEscrowQueries();

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
  }, [publicKey, connection, sendTransaction, bountyId, escrowAccount, updateProgress, invalidateEscrowQueries]);

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
    transactions: transactions ?? [],
    transactionsLoading,
    isRealtimeConnected,
    deposit,
    release,
    refund,
    resetTransaction,
  };
}
