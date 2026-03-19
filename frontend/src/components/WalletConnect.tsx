'use client';

import { FC, useState, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

interface WalletConnectProps {
  className?: string;
}

type Network = 'mainnet-beta' | 'devnet' | 'testnet';

export const WalletConnect: FC<WalletConnectProps> = ({ className = '' }) => {
  const { publicKey, disconnect, connecting, connected } = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();
  const [copied, setCopied] = useState(false);
  const [network, setNetwork] = useState<Network>('mainnet-beta');
  const [showDropdown, setShowDropdown] = useState(false);

  // Truncate wallet address for display
  const truncatedAddress = publicKey 
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : '';

  // Copy address to clipboard
  const copyAddress = useCallback(async () => {
    if (publicKey) {
      await navigator.clipboard.writeText(publicKey.toBase58());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [publicKey]);

  // Handle connect/disconnect
  const handleConnect = useCallback(() => {
    if (connected) {
      disconnect();
    } else {
      setVisible(true);
    }
  }, [connected, disconnect, setVisible]);

  // Network selector
  const networks: Network[] = ['mainnet-beta', 'devnet', 'testnet'];

  return (
    <div className={`wallet-connect ${className}`}>
      {/* Network Selector */}
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg
                     bg-gray-800 border border-gray-700
                     text-gray-300 text-sm font-medium
                     hover:bg-gray-700 transition-colors"
          aria-label="Select network"
        >
          <span className={`w-2 h-2 rounded-full ${
            network === 'mainnet-beta' ? 'bg-green-500' : 
            network === 'devnet' ? 'bg-yellow-500' : 'bg-purple-500'
          }`} />
          <span>{network}</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {showDropdown && (
          <div className="absolute top-full mt-1 right-0 z-10
                          bg-gray-800 border border-gray-700 rounded-lg shadow-lg overflow-hidden">
            {networks.map((net) => (
              <button
                key={net}
                onClick={() => {
                  setNetwork(net);
                  setShowDropdown(false);
                }}
                className={`block w-full px-4 py-2 text-left text-sm
                           ${network === net ? 'bg-brand-500/20 text-brand-400' : 'text-gray-300 hover:bg-gray-700'}
                           transition-colors`}
              >
                {net}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Connect Button / Wallet Info */}
      {connecting ? (
        <button
          disabled
          className="flex items-center gap-2 px-4 py-2 rounded-lg
                     bg-gray-700 text-gray-400 cursor-wait"
        >
          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Connecting...
        </button>
      ) : connected && publicKey ? (
        <div className="flex items-center gap-2">
          {/* Wallet Address with Copy */}
          <button
            onClick={copyAddress}
            className="flex items-center gap-2 px-3 py-2 rounded-lg
                       bg-gray-800 border border-gray-700
                       hover:border-brand-500 transition-colors group"
            title={publicKey.toBase58()}
          >
            <span className="text-brand-400 font-mono text-sm">{truncatedAddress}</span>
            {copied ? (
              <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-gray-500 group-hover:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>

          {/* Disconnect Button */}
          <button
            onClick={disconnect}
            className="flex items-center gap-2 px-3 py-2 rounded-lg
                       bg-red-500/10 border border-red-500/30
                       text-red-400 hover:bg-red-500/20 transition-colors"
            aria-label="Disconnect wallet"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      ) : (
        <button
          onClick={handleConnect}
          className="flex items-center gap-2 px-4 py-2 rounded-lg
                     bg-brand-500 hover:bg-brand-600
                     text-white font-medium
                     transition-colors shadow-lg shadow-brand-500/25"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          Connect Wallet
        </button>
      )}

      <style jsx>{`
        .wallet-connect {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
      `}</style>
    </div>
  );
};

export default WalletConnect;
