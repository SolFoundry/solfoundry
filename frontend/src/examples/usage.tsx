/**
 * Usage Example: Solana Wallet Connect
 * 
 * This example shows how to integrate the WalletConnect component
 * into your SolFoundry dashboard application.
 */

import { WalletProvider } from './components/WalletProvider';
import { WalletConnect } from './components/WalletConnect';
import { useWallet } from './hooks/useWallet';

// Example 1: Basic Usage
export function App() {
  return (
    <WalletProvider network="mainnet-beta">
      <header className="flex justify-between items-center p-4 bg-gray-900">
        <h1 className="text-xl font-bold text-white">SolFoundry</h1>
        <WalletConnect />
      </header>
      
      <main>
        <Dashboard />
      </main>
    </WalletProvider>
  );
}

// Example 2: Access wallet state in components
function Dashboard() {
  const { connected, address, balance } = useWallet();
  
  if (!connected) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Connect your wallet to view your dashboard</p>
      </div>
    );
  }
  
  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Your Wallet</h2>
      <div className="bg-gray-800 rounded-lg p-4">
        <p className="text-gray-400 text-sm">Address</p>
        <p className="text-white font-mono">{address}</p>
        
        <p className="text-gray-400 text-sm mt-4">Balance</p>
        <p className="text-brand-400 text-2xl font-bold">{balance?.toFixed(4) || '...'} SOL</p>
      </div>
    </div>
  );
}

// Example 3: Devnet for testing
export function DevApp() {
  return (
    <WalletProvider network="devnet">
      <div className="min-h-screen bg-gray-900">
        <nav className="border-b border-gray-800 px-6 py-4 flex justify-between">
          <span className="text-white font-bold">SolFoundry (Devnet)</span>
          <WalletConnect />
        </nav>
      </div>
    </WalletProvider>
  );
}

// Example 4: With custom styling
export function StyledApp() {
  return (
    <WalletProvider>
      <WalletConnect className="custom-wallet-connect" />
      
      <style jsx global>{`
        .custom-wallet-connect button {
          border-radius: 8px;
          font-weight: 600;
        }
        
        /* Dark theme with green accents */
        :root {
          --brand-color: #00FF88;
        }
        
        .wallet-connect button {
          background: linear-gradient(135deg, #00FF88, #00CC6A);
          box-shadow: 0 4px 20px rgba(0, 255, 136, 0.25);
        }
        
        .wallet-connect button:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 25px rgba(0, 255, 136, 0.35);
        }
      `}</style>
    </WalletProvider>
  );
}

export default App;
