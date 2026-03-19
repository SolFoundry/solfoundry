import React, { useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Connection, clusterApiUrl } from '@solana/web3.js';
import { toast } from 'react-hot-toast';

interface NetworkOption {
  name: string;
  endpoint: string;
  value: 'mainnet-beta' | 'testnet' | 'devnet';
}

const NETWORKS: NetworkOption[] = [
  {
    name: 'Mainnet Beta',
    endpoint: clusterApiUrl('mainnet-beta'),
    value: 'mainnet-beta'
  },
  {
    name: 'Testnet',
    endpoint: clusterApiUrl('testnet'),
    value: 'testnet'
  },
  {
    name: 'Devnet',
    endpoint: clusterApiUrl('devnet'),
    value: 'devnet'
  }
];

const WalletConnect: React.FC = () => {
  const { publicKey, connected, connecting, disconnect, wallet } = useWallet();
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkOption>(NETWORKS[0]);
  const [connection, setConnection] = useState<Connection>(
    new Connection(NETWORKS[0].endpoint, 'confirmed')
  );

  const handleNetworkChange = useCallback((network: NetworkOption) => {
    setSelectedNetwork(network);
    setConnection(new Connection(network.endpoint, 'confirmed'));
    toast.success(`Switched to ${network.name}`);
  }, []);

  const copyAddress = useCallback(async () => {
    if (publicKey) {
      try {
        await navigator.clipboard.writeText(publicKey.toString());
        toast.success('Address copied to clipboard');
      } catch (error) {
        toast.error('Failed to copy address');
      }
    }
  }, [publicKey]);

  const handleDisconnect = useCallback(async () => {
    try {
      await disconnect();
      toast.success('Wallet disconnected');
    } catch (error) {
      toast.error('Failed to disconnect wallet');
    }
  }, [disconnect]);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Wallet Connection
        </h2>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${
            connected ? 'bg-green-500' : connecting ? 'bg-yellow-500' : 'bg-red-500'
          }`} />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {connected ? 'Connected' : connecting ? 'Connecting...' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Network Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Network
        </label>
        <select
          value={selectedNetwork.value}
          onChange={(e) => {
            const network = NETWORKS.find(n => n.value === e.target.value);
            if (network) handleNetworkChange(network);
          }}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          {NETWORKS.map((network) => (
            <option key={network.value} value={network.value}>
              {network.name}
            </option>
          ))}
        </select>
      </div>

      {/* Wallet Connection Status */}
      {!connected ? (
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Connect your Solana wallet to continue
            </p>
            <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700 !rounded-md !font-medium !py-2 !px-4 !transition-colors" />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Connected Wallet Info */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Wallet
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {wallet?.adapter.name}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Address
                </div>
                <div className="font-mono text-sm text-gray-900 dark:text-white break-all">
                  {publicKey ? formatAddress(publicKey.toString()) : ''}
                </div>
              </div>
              <button
                onClick={copyAddress}
                className="ml-3 p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                title="Copy address"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Network Info */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Network
              </span>
              <span className="text-sm text-gray-900 dark:text-white font-medium">
                {selectedNetwork.name}
              </span>
            </div>
          </div>

          {/* Disconnect Button */}
          <button
            onClick={handleDisconnect}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-md transition-colors focus:ring-2 focus:ring-red-500 focus:outline-none"
          >
            Disconnect Wallet
          </button>
        </div>
      )}
    </div>
  );
};

export default WalletConnect;