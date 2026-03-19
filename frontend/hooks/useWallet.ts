import { useConnection, useWallet as useAdapterWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { useCallback, useMemo } from 'react';

export interface WalletError {
  name: string;
  message: string;
  stack?: string;
}

export interface UseWalletReturn {
  // Connection state
  connected: boolean;
  connecting: boolean;
  disconnecting: boolean;
  
  // Wallet info
  publicKey: PublicKey | null;
  wallet: any;
  
  // Actions
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signTransaction: (transaction: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>;
  signAllTransactions: (transactions: (Transaction | VersionedTransaction)[]) => Promise<(Transaction | VersionedTransaction)[]>;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  
  // Utilities
  copyAddress: () => Promise<void>;
  getShortAddress: () => string | null;
  
  // Error handling
  error: WalletError | null;
}

export const useWallet = (): UseWalletReturn => {
  const { connection } = useConnection();
  const {
    wallet,
    publicKey,
    connected,
    connecting,
    disconnecting,
    connect: adapterConnect,
    disconnect: adapterDisconnect,
    signTransaction: adapterSignTransaction,
    signAllTransactions: adapterSignAllTransactions,
    signMessage: adapterSignMessage,
  } = useAdapterWallet();

  const connect = useCallback(async () => {
    try {
      await adapterConnect();
    } catch (error: any) {
      console.error('Failed to connect wallet:', error);
      throw error;
    }
  }, [adapterConnect]);

  const disconnect = useCallback(async () => {
    try {
      await adapterDisconnect();
    } catch (error: any) {
      console.error('Failed to disconnect wallet:', error);
      throw error;
    }
  }, [adapterDisconnect]);

  const signTransaction = useCallback(async (transaction: Transaction | VersionedTransaction) => {
    if (!adapterSignTransaction) {
      throw new Error('Wallet does not support transaction signing');
    }
    
    try {
      return await adapterSignTransaction(transaction);
    } catch (error: any) {
      console.error('Failed to sign transaction:', error);
      throw error;
    }
  }, [adapterSignTransaction]);

  const signAllTransactions = useCallback(async (transactions: (Transaction | VersionedTransaction)[]) => {
    if (!adapterSignAllTransactions) {
      throw new Error('Wallet does not support signing multiple transactions');
    }
    
    try {
      return await adapterSignAllTransactions(transactions);
    } catch (error: any) {
      console.error('Failed to sign transactions:', error);
      throw error;
    }
  }, [adapterSignAllTransactions]);

  const signMessage = useCallback(async (message: Uint8Array) => {
    if (!adapterSignMessage) {
      throw new Error('Wallet does not support message signing');
    }
    
    try {
      return await adapterSignMessage(message);
    } catch (error: any) {
      console.error('Failed to sign message:', error);
      throw error;
    }
  }, [adapterSignMessage]);

  const copyAddress = useCallback(async () => {
    if (!publicKey) {
      throw new Error('No wallet connected');
    }
    
    try {
      await navigator.clipboard.writeText(publicKey.toString());
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = publicKey.toString();
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
      } catch (fallbackError) {
        console.error('Failed to copy address:', fallbackError);
      }
      document.body.removeChild(textArea);
    }
  }, [publicKey]);

  const getShortAddress = useCallback(() => {
    if (!publicKey) return null;
    
    const address = publicKey.toString();
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  }, [publicKey]);

  const error = useMemo(() => {
    // Extract error from wallet adapter if available
    if (wallet?.adapter?.error) {
      return {
        name: wallet.adapter.error.name || 'WalletError',
        message: wallet.adapter.error.message || 'An unknown wallet error occurred',
        stack: wallet.adapter.error.stack,
      };
    }
    return null;
  }, [wallet]);

  return {
    // Connection state
    connected,
    connecting,
    disconnecting,
    
    // Wallet info
    publicKey,
    wallet,
    
    // Actions
    connect,
    disconnect,
    signTransaction,
    signAllTransactions,
    signMessage,
    
    // Utilities
    copyAddress,
    getShortAddress,
    
    // Error handling
    error,
  };
};

export default useWallet;