/**
 * useEscrow — React Query hook for custodial escrow state management.
 *
 * Provides:
 * - Escrow account data with automatic polling
 * - Deposit flow: standard SPL transfer (user wallet -> treasury) + POST to backend
 * - Release/Refund/Dispute: REST calls to backend (backend signs with treasury keypair)
 * - Transaction progress tracking with full step-by-step UI state
 * - Automatic transaction history and account cache invalidation
 *
 * Architecture (custodial mode):
 * - Deposit: User signs a standard SPL token transfer to the treasury wallet,
 *   then frontend records the deposit via POST /escrow/fund.
 * - Release/Refund/Dispute/Resolve: Backend handles everything — signs with
 *   the treasury keypair and submits directly. Frontend just POSTs to REST endpoints.
 *
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
  TREASURY_WALLET,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  findAssociatedTokenAddress,
} from '../config/constants';
import {
  fetchEscrowAccount,
  fetchEscrowTransactions,
  recordDeposit,
  recordRelease,
  recordRefund,
  releaseEscrow,
  refundEscrow,
  disputeEscrow,
  resolveDisputeRelease,
  resolveDisputeRefund,
} from '../services/escrowService';
import type {
  EscrowAccount,
  EscrowTransaction,
  EscrowTransactionProgress,
  EscrowTransactionStep,
} from '../types/escrow';

/* ── SPL helpers (inline, no @solana/spl-token dependency) ───────────────── */

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
    data: new Uint8Array(0) as Buffer,
  });
}

function buildTransferInstruction(
  source: PublicKey,
  dest: PublicKey,
  owner: PublicKey,
  amount: bigint,
): TransactionInstruction {
  const data = new Uint8Array(9);
  const view = new DataView(data.buffer);
  data[0] = 3; // SPL Transfer instruction discriminator
  view.setBigUint64(1, amount, true); // little-endian u64

  return new TransactionInstruction({
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: dest, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    programId: TOKEN_PROGRAM_ID,
    data: data as Buffer,
  });
}

/** Query key factory for escrow-related queries to ensure cache consistency. */
export const escrowKeys = {
  all: ['escrow'] as const,
  account: (bountyId: string) => [...escrowKeys.all, 'account', bountyId] as const,
  transactions: (bountyId: string) => [...escrowKeys.all, 'transactions', bountyId] as const,
};

/** Polling interval in milliseconds for escrow balance updates. */
const ESCROW_POLL_INTERVAL_MS = 10_000;

/**
 * Categorize a raw error into a user-friendly message.
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

  return message || 'An unexpected transaction error occurred. Please try again.';
}

/** Return type for the useEscrow hook. */
export interface UseEscrowReturn {
  readonly escrowAccount: EscrowAccount | null;
  readonly isLoading: boolean;
  readonly queryError: string | null;
  readonly transactionProgress: EscrowTransactionProgress;
  readonly transactions: EscrowTransaction[];
  readonly transactionsLoading: boolean;
  /** Initiate a deposit: SPL transfer to treasury + record in backend. */
  readonly deposit: (amount: number) => Promise<string>;
  /** Release escrowed funds to the winner (backend-signed). */
  readonly release: (contributorWallet: string) => Promise<string>;
  /** Refund escrowed funds back to the bounty owner (backend-signed). */
  readonly refund: () => Promise<string>;
  /** Open a dispute (backend-signed). */
  readonly dispute: () => Promise<string>;
  /** Resolve dispute by releasing to winner (backend-signed). */
  readonly resolveRelease: (winnerWallet: string) => Promise<string>;
  /** Resolve dispute by refunding to creator (backend-signed). */
  readonly resolveRefund: () => Promise<string>;
  readonly resetTransaction: () => void;
}

/**
 * Hook for managing escrow state and performing custodial escrow transactions.
 * Deposits are standard SPL transfers; all other operations go through the backend.
 */
export function useEscrow(
  bountyId: string,
  options?: { pollingEnabled?: boolean },
): UseEscrowReturn {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const queryClient = useQueryClient();

  const pollingEnabled = options?.pollingEnabled ?? true;

  const bountyIdNum = parseInt(bountyId, 10);

  const [transactionProgress, setTransactionProgress] =
    useState<EscrowTransactionProgress>({
      step: 'idle',
      signature: null,
      errorMessage: null,
      operationType: null,
    });

  /** Fetch escrow account from backend REST API. */
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

  /** Fetch transaction history. */
  const {
    data: transactions,
    isLoading: transactionsLoading,
  } = useQuery({
    queryKey: escrowKeys.transactions(bountyId),
    queryFn: () => fetchEscrowTransactions(bountyId),
    enabled: Boolean(bountyId),
    staleTime: 10_000,
  });

  const queryError = fetchError
    ? fetchError instanceof Error
      ? fetchError.message
      : 'Failed to fetch escrow data'
    : null;

  const updateProgress = useCallback(
    (step: EscrowTransactionStep, extra?: Partial<EscrowTransactionProgress>) => {
      setTransactionProgress((prev) => ({ ...prev, step, ...extra }));
    },
    [],
  );

  const invalidateEscrowQueries = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: escrowKeys.account(bountyId) }),
      queryClient.invalidateQueries({ queryKey: escrowKeys.transactions(bountyId) }),
    ]);
  }, [queryClient, bountyId]);

  /**
   * Deposit $FNDRY tokens into the custodial treasury via standard SPL transfer.
   *
   * Flow:
   * 1. Build a standard SPL token transfer (user wallet -> treasury wallet)
   * 2. User signs with Phantom
   * 3. Wait for on-chain confirmation
   * 4. POST to backend /escrow/fund with the tx signature
   */
  const deposit = useCallback(
    async (amount: number): Promise<string> => {
      if (!publicKey) throw new Error('Wallet not connected');
      if (!signTransaction) throw new Error('Wallet does not support signing');
      if (amount <= 0) throw new Error('Deposit amount must be greater than zero');

      setTransactionProgress({
        step: 'building',
        signature: null,
        errorMessage: null,
        operationType: 'deposit',
      });

      try {
        const rawAmount = BigInt(Math.floor(amount * 10 ** FNDRY_DECIMALS));

        // Derive ATAs for source (user) and destination (treasury)
        const sourceAta = await findAssociatedTokenAddress(publicKey, FNDRY_TOKEN_MINT);
        const destAta = await findAssociatedTokenAddress(TREASURY_WALLET, FNDRY_TOKEN_MINT);

        const tx = new Transaction();

        // Create treasury ATA if it doesn't exist yet (payer = user)
        const destInfo = await connection.getAccountInfo(destAta);
        if (!destInfo) {
          tx.add(buildCreateAtaInstruction(publicKey, destAta, TREASURY_WALLET, FNDRY_TOKEN_MINT));
        }

        // Standard SPL token transfer
        tx.add(buildTransferInstruction(sourceAta, destAta, publicKey, rawAmount));

        // Get recent blockhash
        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash('confirmed');
        tx.recentBlockhash = blockhash;
        tx.feePayer = publicKey;

        updateProgress('approving');

        // User signs with wallet
        const signedTx = await signTransaction(tx);

        updateProgress('sending');

        // Submit to Solana
        const signature = await connection.sendRawTransaction(signedTx.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        });

        updateProgress('confirming', { signature });

        // Confirm
        const confirmation = await connection.confirmTransaction(
          { signature, blockhash, lastValidBlockHeight },
          'confirmed',
        );

        if (confirmation.value.err) {
          throw new Error('Deposit transaction failed on-chain. Please check the explorer for details.');
        }

        // Record deposit in backend (non-fatal — on-chain tx already confirmed)
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
        setTransactionProgress((prev) => ({ ...prev, step: 'error', errorMessage }));
        throw new Error(errorMessage);
      }
    },
    [publicKey, signTransaction, connection, bountyId, updateProgress, invalidateEscrowQueries],
  );

  /**
   * Release escrow to contributor. Backend-signed via REST API.
   */
  const release = useCallback(
    async (contributorWallet: string): Promise<string> => {
      if (!contributorWallet) throw new Error('Contributor wallet address is required');

      setTransactionProgress({
        step: 'building',
        signature: null,
        errorMessage: null,
        operationType: 'release',
      });

      try {
        updateProgress('confirming');

        const result = await releaseEscrow(bountyIdNum, contributorWallet);

        // Record in backend (non-fatal)
        try {
          await recordRelease(bountyId, result.signature, contributorWallet);
        } catch {
          console.warn('Backend release recording failed; backend tx confirmed.');
        }

        await invalidateEscrowQueries();
        updateProgress('confirmed', { signature: result.signature });
        return result.signature;
      } catch (error: unknown) {
        const errorMessage = categorizeTransactionError(error);
        setTransactionProgress((prev) => ({ ...prev, step: 'error', errorMessage }));
        throw new Error(errorMessage);
      }
    },
    [bountyId, bountyIdNum, updateProgress, invalidateEscrowQueries],
  );

  /**
   * Refund escrow to creator. Backend-signed via REST API.
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
      updateProgress('confirming');

      const result = await refundEscrow(bountyIdNum, publicKey.toBase58());

      try {
        await recordRefund(bountyId, result.signature);
      } catch {
        console.warn('Backend refund recording failed; backend tx confirmed.');
      }

      await invalidateEscrowQueries();
      updateProgress('confirmed', { signature: result.signature });
      return result.signature;
    } catch (error: unknown) {
      const errorMessage = categorizeTransactionError(error);
      setTransactionProgress((prev) => ({ ...prev, step: 'error', errorMessage }));
      throw new Error(errorMessage);
    }
  }, [publicKey, bountyId, bountyIdNum, updateProgress, invalidateEscrowQueries]);

  /**
   * Open a dispute. Backend-signed via REST API.
   */
  const dispute = useCallback(async (): Promise<string> => {
    setTransactionProgress({
      step: 'building',
      signature: null,
      errorMessage: null,
      operationType: null,
    });

    try {
      updateProgress('confirming');
      const result = await disputeEscrow(bountyIdNum);
      await invalidateEscrowQueries();
      updateProgress('confirmed', { signature: result.signature });
      return result.signature;
    } catch (error: unknown) {
      const errorMessage = categorizeTransactionError(error);
      setTransactionProgress((prev) => ({ ...prev, step: 'error', errorMessage }));
      throw new Error(errorMessage);
    }
  }, [bountyIdNum, updateProgress, invalidateEscrowQueries]);

  /**
   * Resolve dispute by releasing to winner. Backend-signed via REST API.
   */
  const resolveReleaseHandler = useCallback(
    async (winnerWallet: string): Promise<string> => {
      setTransactionProgress({
        step: 'building',
        signature: null,
        errorMessage: null,
        operationType: 'release',
      });

      try {
        updateProgress('confirming');
        const result = await resolveDisputeRelease(bountyIdNum, winnerWallet);
        await invalidateEscrowQueries();
        updateProgress('confirmed', { signature: result.signature });
        return result.signature;
      } catch (error: unknown) {
        const errorMessage = categorizeTransactionError(error);
        setTransactionProgress((prev) => ({ ...prev, step: 'error', errorMessage }));
        throw new Error(errorMessage);
      }
    },
    [bountyIdNum, updateProgress, invalidateEscrowQueries],
  );

  /**
   * Resolve dispute by refunding to creator. Backend-signed via REST API.
   */
  const resolveRefundHandler = useCallback(async (): Promise<string> => {
    if (!publicKey) throw new Error('Wallet not connected');

    setTransactionProgress({
      step: 'building',
      signature: null,
      errorMessage: null,
      operationType: 'refund',
    });

    try {
      updateProgress('confirming');
      const result = await resolveDisputeRefund(bountyIdNum, publicKey.toBase58());
      await invalidateEscrowQueries();
      updateProgress('confirmed', { signature: result.signature });
      return result.signature;
    } catch (error: unknown) {
      const errorMessage = categorizeTransactionError(error);
      setTransactionProgress((prev) => ({ ...prev, step: 'error', errorMessage }));
      throw new Error(errorMessage);
    }
  }, [publicKey, bountyIdNum, updateProgress, invalidateEscrowQueries]);

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
    deposit,
    release,
    refund,
    dispute,
    resolveRelease: resolveReleaseHandler,
    resolveRefund: resolveRefundHandler,
    resetTransaction,
  };
}
