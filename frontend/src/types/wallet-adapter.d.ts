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

  export function useWallet(): {
    publicKey: unknown;
    connected: boolean;
    connecting: boolean;
    disconnecting: boolean;
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