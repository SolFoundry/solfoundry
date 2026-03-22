/**
 * App — Root component with full routing and layout.
 * All pages wrapped in ThemeProvider + WalletProvider + SiteLayout.
 * @module App
 */
import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletProvider } from './components/wallet/WalletProvider';
import { SiteLayout } from './components/layout/SiteLayout';
import { ThemeProvider } from './contexts/ThemeContext';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './services/queryClient';
import { ToastProvider } from './contexts/ToastContext';
import { ToastContainer } from './components/common/ToastContainer';

/** Catches render errors with retry. */
/**
 * Catches render errors in any descendant component tree.
 * Displays error details with a retry button and a fallback link home.
 */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div
        className="flex flex-col items-center justify-center min-h-[40vh] gap-4 p-8"
        role="alert"
      >
        <p className="text-lg font-semibold text-white">Something went wrong</p>
        <p className="text-sm text-gray-400 text-center max-w-md">
          {error.message}
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => this.setState({ error: null })}
            className="px-4 py-2 rounded-lg bg-[#9945FF]/20 text-[#9945FF] hover:bg-[#9945FF]/30 text-sm"
          >
            Try again
          </button>
          <a
            href="/bounties"
            className="px-4 py-2 rounded-lg bg-white/10 text-gray-300 hover:bg-white/20 text-sm"
          >
            Go home
          </a>
        </div>
      </div>
    );
  }
}

// ── Lazy-loaded page components ──────────────────────────────────────────────
const BountiesPage = lazy(() => import('./pages/BountiesPage'));
const BountyDetailPage = lazy(() => import('./pages/BountyDetailPage'));
const BountyCreatePage = lazy(() => import('./pages/BountyCreatePage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const AgentMarketplacePage = lazy(() => import('./pages/AgentMarketplacePage'));
const AgentProfilePage = lazy(() => import('./pages/AgentProfilePage'));
const TokenomicsPage = lazy(() => import('./pages/TokenomicsPage'));
const ContributorProfilePage = lazy(() => import('./pages/ContributorProfilePage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const CreatorDashboardPage = lazy(() => import('./pages/CreatorDashboardPage'));
const HowItWorksPage = lazy(() => import('./pages/HowItWorksPage'));
const DisputeListPage = lazy(() => import('./pages/DisputeListPage'));
const DisputePage = lazy(() => import('./pages/DisputePage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

// ── Loading spinner ──────────────────────────────────────────────────────────
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-[#9945FF] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400 font-mono">Loading...</p>
      </div>
    </div>
  );
}

// ── Layout wrapper that reads wallet state ───────────────────────────────────
function AppLayout() {
  const location = useLocation();
  const { publicKey, connect, disconnect } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;

  return (
    <SiteLayout
      currentPath={location.pathname}
      walletAddress={walletAddress}
      onConnectWallet={() => connect().catch(console.error)}
      onDisconnectWallet={() => disconnect().catch(console.error)}
    >
      <ErrorBoundary>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          {/* Bounties */}
          <Route path="/" element={<Navigate to="/bounties" replace />} />
          <Route path="/bounties" element={<BountiesPage />} />
          <Route path="/bounties/:id" element={<BountyDetailPage />} />
          <Route path="/bounties/create" element={<BountyCreatePage />} />

          {/* Leaderboard */}
          <Route path="/leaderboard" element={<LeaderboardPage />} />

          {/* Agents */}
          <Route path="/agents" element={<AgentMarketplacePage />} />
          <Route path="/agents/:agentId" element={<AgentProfilePage />} />

          {/* Tokenomics */}
          <Route path="/tokenomics" element={<TokenomicsPage />} />

          {/* How It Works */}
          <Route path="/how-it-works" element={<HowItWorksPage />} />

          {/* Disputes */}
          <Route path="/disputes" element={<DisputeListPage />} />
          <Route path="/disputes/:id" element={<DisputePage />} />

          {/* Contributor and Creator */}
          <Route path="/profile/:username" element={<ContributorProfilePage />} />
          <Route path="/contributor/:username" element={<ContributorProfilePage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/creator" element={<CreatorDashboardPage />} />

          {/* 404 Not Found */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
      </ErrorBoundary>
    </SiteLayout>
  );
}

// ── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider defaultTheme="dark">
          <ToastProvider>
            <WalletProvider defaultNetwork="mainnet-beta">
              <AppLayout />
            </WalletProvider>
            <ToastContainer />
          </ToastProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
