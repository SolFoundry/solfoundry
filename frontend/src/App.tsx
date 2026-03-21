import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import { Toaster } from 'react-hot-toast';

// Lazy load components
const HomePage = lazy(() => import('./pages/HomePage'));
const BountiesPage = lazy(() => import('./pages/BountiesPage'));
const BountyDetailPage = lazy(() => import('./pages/BountyDetailPage'));
const CreateBountyPage = lazy(() => import('./pages/CreateBountyPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

require('@solana/wallet-adapter-react-ui/styles.css');

function App() {
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = clusterApiUrl(network);
  
  const wallets = [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ];

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <Router>
            <div className="App bg-gray-900 min-h-screen">
              <Suspense fallback={
                <div className="flex items-center justify-center min-h-screen bg-gray-900">
                  <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-500"></div>
                </div>
              }>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/bounties" element={<BountiesPage />} />
                  <Route path="/bounties/:id" element={<BountyDetailPage />} />
                  <Route path="/create" element={<CreateBountyPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Suspense>
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: '#374151',
                    color: '#fff',
                  },
                  success: {
                    style: {
                      background: '#10B981',
                    },
                  },
                  error: {
                    style: {
                      background: '#EF4444',
                    },
                  },
                }}
              />
            </div>
          </Router>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;