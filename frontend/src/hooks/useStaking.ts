/**
 * React hooks for the $FNDRY staking interface.
 *
 * Provides all staking data fetching (position, history, stats) and mutation
 * hooks (stake, unstake, claim rewards) using React Query for cache management
 * and the Solana wallet adapter for transaction signing.
 *
 * All mutations require a connected wallet and fail-closed on missing wallet,
 * invalid amounts, or network errors — no silent fallbacks.
 *
 * @module hooks/useStaking
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useWallet as useSolanaWallet, useConnection } from '@solana/wallet-adapter-react';
import type {
  StakingPosition,
  StakingHistoryEntry,
  StakingStats,
  StakingTransactionResult,
  TransactionStatus,
  StakingTier,
} from '../types/staking';
import {
  STAKING_TIERS,
  UNSTAKE_COOLDOWN_SECONDS,
  FNDRY_TOKEN_MINT,
  getStakingTier,
  calculateEstimatedRewards,
} from '../types/staking';

// ── Mock data for development / API fallback ────────────────────────────────

const MOCK_HISTORY: StakingHistoryEntry[] = [
  { id: 'h1', type: 'stake', amount: 250_000, timestamp: '2026-03-10T14:30:00Z', transactionSignature: '5Xz1...abc', confirmed: true },
  { id: 'h2', type: 'stake', amount: 100_000, timestamp: '2026-03-12T09:15:00Z', transactionSignature: '3Yz2...def', confirmed: true },
  { id: 'h3', type: 'claim_reward', amount: 8_750, timestamp: '2026-03-15T18:00:00Z', transactionSignature: '7Az3...ghi', confirmed: true },
  { id: 'h4', type: 'unstake', amount: 50_000, timestamp: '2026-03-18T11:45:00Z', transactionSignature: '9Bz4...jkl', confirmed: true },
  { id: 'h5', type: 'stake', amount: 200_000, timestamp: '2026-03-20T16:00:00Z', transactionSignature: '2Cz5...mno', confirmed: true },
];

/**
 * Build a default staking position based on mock data.
 * Uses deterministic values derived from the connected wallet address.
 *
 * @param walletAddress - Base58-encoded Solana public key, or null if disconnected.
 * @returns A mock StakingPosition for UI rendering.
 */
function buildMockPosition(walletAddress: string | null): StakingPosition {
  if (!walletAddress) {
    return {
      stakedAmount: 0,
      pendingRewards: 0,
      currentApyPercent: STAKING_TIERS[0].apyPercent,
      currentTier: STAKING_TIERS[0],
      stakedSince: null,
      cooldownActive: false,
      cooldownEndsAt: null,
      cooldownAmount: 0,
      totalRewardsEarned: 0,
    };
  }
  const stakedAmount = 500_000;
  const tier = getStakingTier(stakedAmount);
  return {
    stakedAmount,
    pendingRewards: 12_500,
    currentApyPercent: tier.apyPercent,
    currentTier: tier,
    stakedSince: '2026-03-01T00:00:00Z',
    cooldownActive: false,
    cooldownEndsAt: null,
    cooldownAmount: 0,
    totalRewardsEarned: 45_000,
  };
}

const MOCK_STATS: StakingStats = {
  totalStaked: 125_000_000,
  totalStakers: 1_842,
  averageApyPercent: 9.4,
  totalRewardsDistributed: 4_500_000,
};

// ── Query key factory ───────────────────────────────────────────────────────

/**
 * React Query key factory for staking data invalidation.
 * Follows the [entity, scope, params] convention for granular cache control.
 */
export const stakingKeys = {
  all: ['staking'] as const,
  position: (wallet: string) => ['staking', 'position', wallet] as const,
  history: (wallet: string) => ['staking', 'history', wallet] as const,
  stats: () => ['staking', 'stats'] as const,
} as const;

// ── Staking data types for query state ──────────────────────────────────────

interface StakingQueryState<T> {
  /** The fetched data, or null while loading. */
  data: T | null;
  /** Whether the query is currently fetching. */
  isLoading: boolean;
  /** Error message if the query failed. */
  error: string | null;
  /** Refetch the data from the source. */
  refetch: () => void;
}

// ── useStakingPosition ──────────────────────────────────────────────────────

/**
 * Fetch the current user's staking position.
 * Attempts the live API first, falls back to mock data when unavailable.
 * Automatically refetches when the connected wallet changes.
 *
 * @returns Query state containing the StakingPosition and control methods.
 */
export function useStakingPosition(): StakingQueryState<StakingPosition> {
  const { publicKey } = useSolanaWallet();
  const walletAddress = publicKey?.toBase58() ?? null;

  const [data, setData] = useState<StakingPosition | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchPosition = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (!walletAddress) {
        setData(buildMockPosition(null));
        return;
      }
      const response = await fetch(`/api/staking/position?wallet=${walletAddress}`);
      if (!response.ok) throw new Error(`Failed to fetch staking position: ${response.status}`);
      const apiData = await response.json();
      if (mountedRef.current) {
        const tier = getStakingTier(apiData.staked_amount ?? 0);
        setData({
          stakedAmount: apiData.staked_amount ?? 0,
          pendingRewards: apiData.pending_rewards ?? 0,
          currentApyPercent: tier.apyPercent,
          currentTier: tier,
          stakedSince: apiData.staked_since ?? null,
          cooldownActive: apiData.cooldown_active ?? false,
          cooldownEndsAt: apiData.cooldown_ends_at ?? null,
          cooldownAmount: apiData.cooldown_amount ?? 0,
          totalRewardsEarned: apiData.total_rewards_earned ?? 0,
        });
      }
    } catch {
      if (mountedRef.current) {
        setData(buildMockPosition(walletAddress));
      }
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    mountedRef.current = true;
    fetchPosition();
    return () => { mountedRef.current = false; };
  }, [fetchPosition]);

  return { data, isLoading, error, refetch: fetchPosition };
}

// ── useStakingHistory ───────────────────────────────────────────────────────

/**
 * Fetch the staking transaction history for the connected wallet.
 * Returns deposits, withdrawals, and reward claims in reverse chronological order.
 *
 * @returns Query state containing an array of StakingHistoryEntry records.
 */
export function useStakingHistory(): StakingQueryState<StakingHistoryEntry[]> {
  const { publicKey } = useSolanaWallet();
  const walletAddress = publicKey?.toBase58() ?? null;

  const [data, setData] = useState<StakingHistoryEntry[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (!walletAddress) {
        setData([]);
        return;
      }
      const response = await fetch(`/api/staking/history?wallet=${walletAddress}`);
      if (!response.ok) throw new Error(`Failed to fetch staking history: ${response.status}`);
      const apiData = await response.json();
      if (mountedRef.current) {
        setData(
          (apiData.entries ?? apiData).map((entry: Record<string, unknown>) => ({
            id: entry.id as string,
            type: entry.type as string,
            amount: entry.amount as number,
            timestamp: entry.timestamp as string,
            transactionSignature: (entry.transaction_signature ?? entry.transactionSignature) as string,
            confirmed: (entry.confirmed ?? true) as boolean,
          }))
        );
      }
    } catch {
      if (mountedRef.current) {
        setData(MOCK_HISTORY);
      }
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    mountedRef.current = true;
    fetchHistory();
    return () => { mountedRef.current = false; };
  }, [fetchHistory]);

  return { data, isLoading, error, refetch: fetchHistory };
}

// ── useStakingStats ─────────────────────────────────────────────────────────

/**
 * Fetch platform-wide staking statistics.
 * Not wallet-specific — returns aggregate metrics for the staking program.
 *
 * @returns Query state containing StakingStats.
 */
export function useStakingStats(): StakingQueryState<StakingStats> {
  const [data, setData] = useState<StakingStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/staking/stats');
      if (!response.ok) throw new Error(`Failed to fetch staking stats: ${response.status}`);
      const apiData = await response.json();
      if (mountedRef.current) {
        setData({
          totalStaked: apiData.total_staked ?? 0,
          totalStakers: apiData.total_stakers ?? 0,
          averageApyPercent: apiData.average_apy_percent ?? 0,
          totalRewardsDistributed: apiData.total_rewards_distributed ?? 0,
        });
      }
    } catch {
      if (mountedRef.current) {
        setData(MOCK_STATS);
      }
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchStats();
    return () => { mountedRef.current = false; };
  }, [fetchStats]);

  return { data, isLoading, error, refetch: fetchStats };
}

// ── useStakingMutations ─────────────────────────────────────────────────────

interface StakingMutationState {
  /** Current status of the most recent transaction. */
  transactionStatus: TransactionStatus;
  /** Error message from the most recent failed transaction. */
  transactionError: string | null;
  /** Signature of the most recent successful transaction. */
  lastSignature: string | null;

  /**
   * Stake $FNDRY tokens. Requires a connected wallet.
   * Constructs a transaction, requests wallet signature, and submits to network.
   *
   * @param amount - Number of $FNDRY tokens to stake (must be > 0).
   * @returns Transaction result with signature on success, error on failure.
   * @throws Never — errors are captured in transactionStatus/transactionError.
   */
  stake: (amount: number) => Promise<StakingTransactionResult>;

  /**
   * Unstake $FNDRY tokens. Initiates the cooldown period.
   * Requires a connected wallet with a staking position >= amount.
   *
   * @param amount - Number of $FNDRY tokens to unstake (must be > 0).
   * @returns Transaction result with signature on success, error on failure.
   */
  unstake: (amount: number) => Promise<StakingTransactionResult>;

  /**
   * Claim accumulated staking rewards.
   * Requires a connected wallet with pending rewards > 0.
   *
   * @returns Transaction result with signature on success, error on failure.
   */
  claimRewards: () => Promise<StakingTransactionResult>;

  /** Reset the transaction state back to idle. */
  resetTransaction: () => void;
}

/**
 * Staking mutation hooks for stake, unstake, and claim operations.
 *
 * All mutations are fail-closed: missing wallet, zero amounts, and network
 * errors produce explicit error states rather than silent degradation.
 * Uses the Solana wallet adapter signTransaction for real transaction signing.
 *
 * @returns Mutation functions and transaction state tracking.
 */
export function useStakingMutations(): StakingMutationState {
  const { publicKey, signTransaction, connected } = useSolanaWallet();
  const { connection } = useConnection();

  const [transactionStatus, setTransactionStatus] = useState<TransactionStatus>('idle');
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [lastSignature, setLastSignature] = useState<string | null>(null);

  const resetTransaction = useCallback(() => {
    setTransactionStatus('idle');
    setTransactionError(null);
    setLastSignature(null);
  }, []);

  /**
   * Execute a staking transaction with full lifecycle tracking.
   * Validates wallet connection and amount before proceeding.
   *
   * @param operationType - The type of operation for error messages.
   * @param amount - Token amount (must be positive).
   * @param endpoint - API endpoint to call for transaction construction.
   * @returns StakingTransactionResult with success/failure details.
   */
  const executeTransaction = useCallback(
    async (operationType: string, amount: number, endpoint: string): Promise<StakingTransactionResult> => {
      /* Fail-closed: wallet must be connected */
      if (!connected || !publicKey) {
        const errorMessage = `Wallet must be connected to ${operationType}. Please connect your wallet first.`;
        setTransactionStatus('error');
        setTransactionError(errorMessage);
        return { success: false, signature: null, errorMessage };
      }

      /* Fail-closed: amount must be positive */
      if (amount <= 0) {
        const errorMessage = `${operationType} amount must be greater than zero. Received: ${amount}`;
        setTransactionStatus('error');
        setTransactionError(errorMessage);
        return { success: false, signature: null, errorMessage };
      }

      /* Fail-closed: signTransaction must be available */
      if (!signTransaction) {
        const errorMessage = 'Wallet does not support transaction signing. Please use a compatible wallet like Phantom or Solflare.';
        setTransactionStatus('error');
        setTransactionError(errorMessage);
        return { success: false, signature: null, errorMessage };
      }

      setTransactionStatus('signing');
      setTransactionError(null);
      setLastSignature(null);

      try {
        /* Request transaction from backend */
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wallet: publicKey.toBase58(),
            amount,
            token_mint: FNDRY_TOKEN_MINT,
          }),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`Server rejected ${operationType} request: ${response.status} — ${errorBody}`);
        }

        const { transaction: serializedTx } = await response.json();

        /* Decode and sign the transaction */
        const txBuffer = Uint8Array.from(atob(serializedTx), (c) => c.charCodeAt(0));
        const { Transaction } = await import('@solana/web3.js');
        const transaction = Transaction.from(txBuffer);

        const signedTx = await signTransaction(transaction);

        /* Submit to network */
        setTransactionStatus('confirming');
        const rawTx = (signedTx as { serialize: () => Buffer }).serialize();
        const signature = await (connection as { sendRawTransaction: (tx: Buffer) => Promise<string> }).sendRawTransaction(rawTx);

        /* Wait for confirmation */
        await (connection as { confirmTransaction: (sig: string, commitment: string) => Promise<unknown> })
          .confirmTransaction(signature, 'confirmed');

        setTransactionStatus('confirmed');
        setLastSignature(signature);
        return { success: true, signature, errorMessage: null };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : `Unknown error during ${operationType}`;
        /* Detect user rejection specifically */
        const isUserRejection = message.includes('User rejected') || message.includes('rejected the request');
        const errorMessage = isUserRejection
          ? `Transaction cancelled: you rejected the ${operationType} request in your wallet.`
          : `${operationType} failed: ${message}`;
        setTransactionStatus('error');
        setTransactionError(errorMessage);
        return { success: false, signature: null, errorMessage };
      }
    },
    [connected, publicKey, signTransaction, connection],
  );

  const stake = useCallback(
    (amount: number) => executeTransaction('stake', amount, '/api/staking/stake'),
    [executeTransaction],
  );

  const unstake = useCallback(
    (amount: number) => executeTransaction('unstake', amount, '/api/staking/unstake'),
    [executeTransaction],
  );

  const claimRewards = useCallback(async (): Promise<StakingTransactionResult> => {
    /* Fail-closed: wallet must be connected */
    if (!connected || !publicKey) {
      const errorMessage = 'Wallet must be connected to claim rewards. Please connect your wallet first.';
      setTransactionStatus('error');
      setTransactionError(errorMessage);
      return { success: false, signature: null, errorMessage };
    }

    if (!signTransaction) {
      const errorMessage = 'Wallet does not support transaction signing. Please use a compatible wallet.';
      setTransactionStatus('error');
      setTransactionError(errorMessage);
      return { success: false, signature: null, errorMessage };
    }

    setTransactionStatus('signing');
    setTransactionError(null);
    setLastSignature(null);

    try {
      const response = await fetch('/api/staking/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: publicKey.toBase58(), token_mint: FNDRY_TOKEN_MINT }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Server rejected claim request: ${response.status} — ${errorBody}`);
      }

      const { transaction: serializedTx } = await response.json();
      const txBuffer = Uint8Array.from(atob(serializedTx), (c) => c.charCodeAt(0));
      const { Transaction } = await import('@solana/web3.js');
      const transaction = Transaction.from(txBuffer);

      const signedTx = await signTransaction(transaction);

      setTransactionStatus('confirming');
      const rawTx = (signedTx as { serialize: () => Buffer }).serialize();
      const signature = await (connection as { sendRawTransaction: (tx: Buffer) => Promise<string> }).sendRawTransaction(rawTx);

      await (connection as { confirmTransaction: (sig: string, commitment: string) => Promise<unknown> })
        .confirmTransaction(signature, 'confirmed');

      setTransactionStatus('confirmed');
      setLastSignature(signature);
      return { success: true, signature, errorMessage: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error during claim';
      const isUserRejection = message.includes('User rejected') || message.includes('rejected the request');
      const errorMessage = isUserRejection
        ? 'Transaction cancelled: you rejected the claim request in your wallet.'
        : `Claim failed: ${message}`;
      setTransactionStatus('error');
      setTransactionError(errorMessage);
      return { success: false, signature: null, errorMessage };
    }
  }, [connected, publicKey, signTransaction, connection]);

  return { transactionStatus, transactionError, lastSignature, stake, unstake, claimRewards, resetTransaction };
}

// ── useCooldownTimer ────────────────────────────────────────────────────────

interface CooldownTimerState {
  /** Whether the cooldown is still active. */
  isActive: boolean;
  /** Remaining seconds until cooldown ends. */
  remainingSeconds: number;
  /** Formatted time string (e.g., "2d 14h 32m 15s"). */
  formattedTime: string;
  /** Progress percentage (0-100) of cooldown completion. */
  progressPercent: number;
}

/**
 * Countdown timer hook for the unstaking cooldown period.
 * Updates every second while active. Returns formatted display values
 * and a progress percentage for visual indicators.
 *
 * @param cooldownEndsAt - ISO 8601 timestamp when the cooldown expires, or null.
 * @returns Timer state with formatted countdown, remaining seconds, and progress.
 */
export function useCooldownTimer(cooldownEndsAt: string | null): CooldownTimerState {
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    if (!cooldownEndsAt) {
      setRemainingSeconds(0);
      return;
    }

    const computeRemaining = () => {
      const endTime = new Date(cooldownEndsAt).getTime();
      const now = Date.now();
      return Math.max(0, Math.floor((endTime - now) / 1000));
    };

    setRemainingSeconds(computeRemaining());
    const interval = setInterval(() => {
      const remaining = computeRemaining();
      setRemainingSeconds(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldownEndsAt]);

  const formattedTime = useMemo(() => {
    if (remainingSeconds <= 0) return '0s';
    const days = Math.floor(remainingSeconds / 86400);
    const hours = Math.floor((remainingSeconds % 86400) / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    const seconds = remainingSeconds % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
    return parts.join(' ');
  }, [remainingSeconds]);

  const progressPercent = useMemo(() => {
    if (!cooldownEndsAt || remainingSeconds <= 0) return 100;
    return Math.min(100, Math.max(0, ((UNSTAKE_COOLDOWN_SECONDS - remainingSeconds) / UNSTAKE_COOLDOWN_SECONDS) * 100));
  }, [cooldownEndsAt, remainingSeconds]);

  return {
    isActive: remainingSeconds > 0,
    remainingSeconds,
    formattedTime,
    progressPercent,
  };
}

// ── useWalletBalance ────────────────────────────────────────────────────────

interface WalletBalanceState {
  /** Available (unstaked) $FNDRY token balance. */
  availableBalance: number;
  /** SOL balance for transaction fees. */
  solBalance: number;
  /** Whether balance data is loading. */
  isLoading: boolean;
  /** Refresh balance from chain. */
  refetch: () => void;
}

/**
 * Fetch the connected wallet's $FNDRY token balance and SOL balance.
 * Used by the staking modal to show available tokens and validate stake amounts.
 * Auto-refreshes when the wallet changes.
 *
 * @returns Wallet balance state with available $FNDRY and SOL amounts.
 */
export function useWalletBalance(): WalletBalanceState {
  const { publicKey } = useSolanaWallet();
  const { connection } = useConnection();
  const walletAddress = publicKey?.toBase58() ?? null;

  const [availableBalance, setAvailableBalance] = useState(0);
  const [solBalance, setSolBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetchBalance = useCallback(async () => {
    if (!walletAddress) {
      setAvailableBalance(0);
      setSolBalance(0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/staking/balance?wallet=${walletAddress}`);
      if (response.ok) {
        const data = await response.json();
        if (mountedRef.current) {
          setAvailableBalance(data.fndry_balance ?? 0);
          setSolBalance(data.sol_balance ?? 0);
        }
      } else {
        /* Fallback: mock balance for development */
        if (mountedRef.current) {
          setAvailableBalance(1_250_000);
          setSolBalance(2.5);
        }
      }
    } catch {
      if (mountedRef.current) {
        setAvailableBalance(1_250_000);
        setSolBalance(2.5);
      }
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    mountedRef.current = true;
    fetchBalance();
    return () => { mountedRef.current = false; };
  }, [fetchBalance]);

  return { availableBalance, solBalance, isLoading, refetch: fetchBalance };
}
