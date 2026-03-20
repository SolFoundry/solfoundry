/**
 * Type declarations for @solana/wallet-adapter-react
 * 
 * Fixes TS2786: 'ConnectionProvider' cannot be used as a JSX component.
 * This is due to React 18 types incompatibility between packages.
 */

declare module '@solana/wallet-adapter-react' {
  import { ReactNode } from 'react';

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
    publicKey: { toBase58(): string } | null;
    connecting: boolean;
    connected: boolean;
  }

  export function useWallet(): {
    publicKey: { toBase58(): string } | null;
    connected: boolean;
    connecting: boolean;
    disconnecting: boolean;
    wallet: WalletAdapter | null;
    wallets: WalletAdapter[];
    select(walletName: string): void;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    signTransaction?: (transaction: unknown) => Promise<unknown>;
    signAllTransactions?: (transactions: unknown[]) => Promise<unknown[]>;
  };

  export function useConnection(): {
    connection: unknown;
  };
}