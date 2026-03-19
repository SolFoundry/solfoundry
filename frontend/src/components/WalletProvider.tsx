'use client';

import { FC, ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter, BackpackWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

interface WalletProviderProps {
  children: ReactNode;
  network?: 'mainnet-beta' | 'devnet' | 'testnet';
}

export const WalletProvider: FC<WalletProviderProps> = ({ 
  children, 
  network = 'mainnet-beta' 
}) => {
  // Connection endpoint based on network
  const endpoint = useMemo(() => {
    if (network === 'mainnet-beta') {
      return 'https://api.mainnet-beta.solana.com';
    }
    return clusterApiUrl(network);
  }, [network]);

  // Supported wallets: Phantom, Solflare, Backpack
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new BackpackWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
};

export default WalletProvider;
