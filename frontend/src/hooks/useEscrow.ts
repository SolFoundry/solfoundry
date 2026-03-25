/**
 * useEscrow — React Query hook for escrow state management and PDA program transactions.
 *
 * Provides:
 * - Escrow account data with automatic polling and WebSocket real-time balance updates
 * - Deposit flow: backend builds unsigned tx → wallet signs → send + confirm
 * - Release/Refund: backend-signed authority operations via PDA API
 * - Dispute + resolve: backend-signed authority operations
 * - Transaction progress tracking with full step-by-step UI state
 * - Automatic transaction history and account cache invalidation
 *
 * Architecture:
 * - User-signed ops (create+deposit): Backend builds unsigned Message via /api/pda/escrow/create,
 *   frontend deserializes, wallet signs, frontend submits to Solana.
 * - Authority-signed ops (assign, release, refund, dispute, resolve): Backend signs
 *   with PDA authority keypair, submits directly, returns tx signature.
 *
 * @module hooks/useEscrow
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  PublicKey,
  Transaction,
  Message,
} from '@solana/web3.js';
import {
  FNDRY_TOKEN_MINT,
  FNDRY_DECIMALS,
  deriveEscrowPda,
  findAssociatedTokenAddress,
} from '../config/constants';
import {
  fetchEscrowAccount,
  fetchEscrowTransactions,
  recordDeposit,
  recordRelease,
  recordRefund,
  buildCreateEscrowTx,
  releaseEscrow,
  refundEscrow,
  disputeEscrow,
  resolveDisputeRelease,
  resolveDisputeRefund,
  assignContributor,
  fetchOnChainEscrowState,
} from '../services/escrowService';
import type {
  EscrowAccount,
  EscrowTransaction,
  EscrowTransactionProgress,
  EscrowTransactionStep,
} from '../types/escrow';

/** Query key factory for escrow-related queries to ensure cache consistency. */
export const escrowKeys = {
  all: ['escrow'] as const,
  account: (bountyId: string) => [...escrowKeys.all, 'account', bountyId] as const,
  transactions: (bountyId: string) => [...escrowKeys.all, 'transactions', bountyId] as const,
  onchain: (bountyId: string) => [...escrowKeys.all, 'onchain', bountyId] as const,
};

/** Polling interval in milliseconds for real-time escrow balance updates. */
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
  if (message.includes('custom program error') || message.includes('InstructionError')) {
    return 'The escrow program rejected this transaction. Please check your permissions and try again.';
  }
  if (message.includes('authority') || message.includes('PDA_AUTHORITY')) {
    return 'Backend authority not configured. Please contact support.';
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
  readonly isRealtimeConnected: boolean;
  /** On-chain escrow state (from Solana directly) */
  readonly onChainState: OnChainState | null;
  readonly onChainLoading: boolean;
  /** Initiate a deposit: create escrow PDA + fund it in one transaction. */
  readonly deposit: (amount: number, deadline?: number) => Promise<string>;
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
  /** Assign a contributor to the escrow (backend-signed). */
  readonly assign: (contributorWallet: string) => Promise<string>;
  readonly resetTransaction: () => void;
}

interface OnChainState {
  bounty_id: number;
  creator: string;
  winner: string;
  authority: string;
  token_mint: string;
  amount: number;
  state: string;
  created_at: number;
  deadline: number;
}

/**
 * Hook for managing escrow state and performing PDA program transactions.
 */
export function useEscrow(
  bountyId: string,
  options?: { pollingEnabled?: boolean; realtimeEnabled?: boolean },
): UseEscrowReturn {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const queryClient = useQueryClient();

  const pollingEnabled = options?.pollingEnabled ?? true;
  const realtimeEnabled = options?.realtimeEnabled ?? true;
  const websocketRef = useRef<{ close: () => void } | null>(null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

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

  /** Fetch on-chain escrow state from Solana via backend PDA API. */
  const {
    data: onChainState,
    isLoading: onChainLoading,
  } = useQuery({
    queryKey: escrowKeys.onchain(bountyId),
    queryFn: () => fetchOnChainEscrowState(bountyIdNum),
    enabled: Boolean(bountyId) && !isNaN(bountyIdNum),
    refetchInterval: pollingEnabled ? ESCROW_POLL_INTERVAL_MS : false,
    staleTime: 5_000,
    retry: false, // 404 is expected when escrow not yet created
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

  /**
   * WebSocket subscription for real-time escrow balance updates.
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
              queryClient.invalidateQueries({ queryKey: escrowKeys.onchain(bountyId) });
            }
          },
          'confirmed',
        );

        if (!cancelled) {
          setIsRealtimeConnected(true);
        }

        websocketRef.current = {
          close: () => connection.removeAccountChangeListener(subscriptionId),
        };
      } catch {
        if (!cancelled) setIsRealtimeConnected(false);
      }
    }

    setupWebSocket();

    return () => {
      cancelled = true;
      setIsRealtimeConnected(false);
      websocketRef.current?.close();
      websocketRef.current = null;
    };
  }, [bountyId, connection, queryClient, realtimeEnabled]);

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
      queryClient.invalidateQueries({ queryKey: escrowKeys.onchain(bountyId) }),
    ]);
  }, [queryClient, bountyId]);

  /**
   * Create escrow + deposit $FNDRY tokens.
   * Backend builds the unsigned transaction, wallet signs, frontend submits.
   */
  const deposit = useCallback(
    async (amount: number, deadline?: number): Promise<string> => {
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
        const rawAmount = Math.floor(amount * 10 ** FNDRY_DECIMALS);
        const deadlineTs = deadline || Math.floor(Date.now() / 1000) + 30 * 24 * 3600; // 30 days default

        // 1. Backend builds the unsigned transaction
        const { transaction: txBase64, escrow_pda, vault_pda, blockhash } =
          await buildCreateEscrowTx(
            bountyIdNum,
            rawAmount,
            deadlineTs,
            publicKey.toBase58(),
          );

        updateProgress('approving');

        // 2. Deserialize the message into a legacy Transaction for wallet signing
        const messageBytes = Buffer.from(txBase64, 'base64');
        const message = Message.from(messageBytes);
        const tx = Transaction.populate(message);

        // 3. Wallet signs
        const signedTx = await signTransaction(tx);

        updateProgress('sending');

        // 4. Submit to Solana
        const signature = await connection.sendRawTransaction(signedTx.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        });

        updateProgress('confirming', { signature });

        // 5. Confirm
        const confirmation = await connection.confirmTransaction(signature, 'confirmed');

        if (confirmation.value.err) {
          throw new Error('Deposit transaction failed on-chain. Please check the explorer for details.');
        }

        // 6. Record deposit in backend (non-fatal)
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
    [publicKey, signTransaction, connection, bountyId, bountyIdNum, updateProgress, invalidateEscrowQueries],
  );

  /**
   * Release escrow to contributor. Backend-signed by authority.
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
          console.warn('Backend release recording failed; on-chain tx confirmed.');
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
   * Refund escrow to creator. Backend-signed by authority.
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
        console.warn('Backend refund recording failed; on-chain tx confirmed.');
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
   * Open a dispute. Backend-signed by authority.
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
   * Resolve dispute by releasing to winner. Backend-signed.
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
   * Resolve dispute by refunding to creator. Backend-signed.
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

  /**
   * Assign a contributor to the escrow. Backend-signed.
   */
  const assign = useCallback(
    async (contributorWallet: string): Promise<string> => {
      try {
        const result = await assignContributor(bountyIdNum, contributorWallet);
        await invalidateEscrowQueries();
        return result.signature;
      } catch (error: unknown) {
        throw new Error(categorizeTransactionError(error));
      }
    },
    [bountyIdNum, invalidateEscrowQueries],
  );

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
    onChainState: onChainState ?? null,
    onChainLoading,
    deposit,
    release,
    refund,
    dispute,
    resolveRelease: resolveReleaseHandler,
    resolveRefund: resolveRefundHandler,
    assign,
    resetTransaction,
  };
}
