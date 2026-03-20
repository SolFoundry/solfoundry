/** Hooks for querying $FNDRY SPL token balance and executing escrow transfers. */
import { useState, useEffect, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Transaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from '@solana/spl-token';
import { FNDRY_TOKEN_MINT, FNDRY_DECIMALS, ESCROW_WALLET } from '../config/constants';
import type { TransactionStatus, EscrowTransactionState } from '../types/wallet';

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
      const ata = await getAssociatedTokenAddress(FNDRY_TOKEN_MINT, publicKey);
      const account = await getAccount(connection, ata);
      const raw = account.amount;
      setRawBalance(raw);
      setBalance(Number(raw) / 10 ** FNDRY_DECIMALS);
    } catch (err: unknown) {
      const name = err instanceof Error ? (err as Error & { name?: string }).name : '';
      if (name === 'TokenAccountNotFoundError') {
        setBalance(0);
        setRawBalance(BigInt(0));
      } else {
        setError('Failed to fetch $FNDRY balance');
        setBalance(null);
      }
    } finally {
      setLoading(false);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return { balance, rawBalance, loading, error, refetch: fetchBalance };
}

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

        const sourceAta = await getAssociatedTokenAddress(FNDRY_TOKEN_MINT, publicKey);
        const destAta = await getAssociatedTokenAddress(FNDRY_TOKEN_MINT, ESCROW_WALLET);

        const tx = new Transaction();

        // Create escrow ATA if it doesn't exist yet (payer = user)
        try {
          await getAccount(connection, destAta);
        } catch {
          tx.add(
            createAssociatedTokenAccountInstruction(publicKey, destAta, ESCROW_WALLET, FNDRY_TOKEN_MINT),
          );
        }

        tx.add(createTransferInstruction(sourceAta, destAta, publicKey, rawAmount));

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

        setTransaction(prev => ({
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
