/**
 * Type declarations for @solana/wallet-adapter-react
 *
 * Fixes TS2786: 'ConnectionProvider' cannot be used as a JSX component.
 * React 18 types incompatibility between packages.
 */

declare module '@solana/wallet-adapter-react' {
  import { ReactNode } from 'react';
  import { Connection, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';

  export interface ConnectionProviderProps {
    children: ReactNode;
    endpoint: string;
    commitment?: string;
  }

  export const ConnectionProvider: (props: ConnectionProviderProps) => JSX.Element;

  export interface WalletProviderProps {
    children: ReactNode;
    wallets: unknown[];
    autoConnect?: boolean;
  }

  export const WalletProvider: (props: WalletProviderProps) => JSX.Element;

  interface WalletAdapter {
    name: string;
    url: string;
    icon: string;
    readyState: string;
    publicKey: PublicKey | null;
    connecting: boolean;
    connected: boolean;
    adapter: WalletAdapter;
  }

  interface SendTransactionOptions {
    signers?: Array<{ publicKey: PublicKey; secretKey: Uint8Array }>;
    skipPreflight?: boolean;
    preflightCommitment?: string;
    maxRetries?: number;
    minContextSlot?: number;
  }

  export function useWallet(): {
    publicKey: PublicKey | null;
    connected: boolean;
    connecting: boolean;
    disconnecting: boolean;
    wallet: WalletAdapter | null;
    wallets: WalletAdapter[];
    select(walletName: string): void;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    sendTransaction(
      transaction: Transaction | VersionedTransaction,
      connection: Connection,
      options?: SendTransactionOptions,
    ): Promise<string>;
    signTransaction?: (transaction: Transaction) => Promise<Transaction>;
    signAllTransactions?: (transactions: Transaction[]) => Promise<Transaction[]>;
  };

  export function useConnection(): {
    connection: Connection;
  };
}