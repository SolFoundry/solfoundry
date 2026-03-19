'use client';

import { useWallet as useSolanaWallet, useConnection } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL, Connection, PublicKey } from '@solana/web3.js';
import { useCallback, useEffect, useState } from 'react';

interface WalletState {
  connected: boolean;
  connecting: boolean;
  address: string | null;
  balance: number | null;
  network: string;
}

interface UseWalletReturn extends WalletState {
  connect: () => void;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
  signMessage: (message: string) => Promise<Uint8Array | null>;
}

export function useWallet(): UseWalletReturn {
  const wallet = useSolanaWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState<number | null>(null);

  const {
    publicKey,
    connected,
    connecting,
    disconnect,
    signMessage: walletSignMessage,
  } = wallet;

  // Fetch balance when wallet connects
  const refreshBalance = useCallback(async () => {
    if (publicKey && connection) {
      try {
        const balance = await connection.getBalance(publicKey);
        setBalance(balance / LAMPORTS_PER_SOL);
      } catch (error) {
        console.error('Failed to fetch balance:', error);
        setBalance(null);
      }
    } else {
      setBalance(null);
    }
  }, [publicKey, connection]);

  // Auto-refresh balance on connection
  useEffect(() => {
    if (connected) {
      refreshBalance();
      
      // Refresh every 30 seconds
      const interval = setInterval(refreshBalance, 30000);
      return () => clearInterval(interval);
    }
  }, [connected, refreshBalance]);

  // Sign a message
  const signMessage = useCallback(async (message: string): Promise<Uint8Array | null> => {
    if (!walletSignMessage) {
      console.error('Wallet does not support message signing');
      return null;
    }
    
    try {
      const encodedMessage = new TextEncoder().encode(message);
      const signature = await walletSignMessage(encodedMessage);
      return signature;
    } catch (error) {
      console.error('Failed to sign message:', error);
      return null;
    }
  }, [walletSignMessage]);

  return {
    connected,
    connecting,
    address: publicKey?.toBase58() || null,
    balance,
    network: connection.rpcEndpoint.includes('mainnet') ? 'mainnet-beta' :
             connection.rpcEndpoint.includes('devnet') ? 'devnet' : 'testnet',
    connect: () => {}, // Handled by wallet modal
    disconnect,
    refreshBalance,
    signMessage,
  };
}

export default useWallet;
