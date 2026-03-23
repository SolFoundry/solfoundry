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
import { SolFoundryLogoMark } from './components/common/SolFoundryLogoMark';
import { ErrorBoundary } from './components/ErrorBoundary';

// ── Lazy-loaded page components ──────────────────────────────────────────────
const BountiesPage = lazy(() => import('./pages/BountiesPage'));
const BountyDetailPage = lazy(() => import('./pages/BountyDetailPage'));
const BountyCreatePage = lazy(() => import('./pages/BountyCreatePage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const AgentMarketplacePage = lazy(() => import('./pages/AgentMarketplacePage'));
const AgentRegisterPage = lazy(() => import('./pages/AgentRegisterPage'));
const AgentApiDocsPage = lazy(() => import('./pages/AgentApiDocsPage'));
const AgentProfilePage = lazy(() => import('./pages/AgentProfilePage'));
const TokenomicsPage = lazy(() => import('./pages/TokenomicsPage'));
const ContributorProfilePage = lazy(() => import('./pages/ContributorProfilePage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const CreatorDashboardPage = lazy(() => import('./pages/CreatorDashboardPage'));
const HowItWorksPage = lazy(() => import('./pages/HowItWorksPage'));
const DisputeListPage = lazy(() => import('./pages/DisputeListPage'));
const DisputePage = lazy(() => import('./pages/DisputePage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));

// ── Loading spinner ──────────────────────────────────────────────────────────
function LoadingSpinner() {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center bg-surface-light dark:bg-surface">
      <div className="flex flex-col items-center gap-4" role="status" aria-live="polite" aria-label="Loading page">
        <SolFoundryLogoMark size="md" className="opacity-90 animate-pulse shadow-lg shadow-solana-purple/20" />
        <div className="h-8 w-8 border-2 border-solana-purple border-t-transparent rounded-full animate-spin" aria-hidden />
        <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">Loading...</p>
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

          {/* Agents — static paths before :agentId */}
          <Route path="/agents/register" element={<AgentRegisterPage />} />
          <Route path="/agents/docs" element={<AgentApiDocsPage />} />
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
          <Route path="/contributor/:username" element={<ContributorProfilePage />} />
          <Route path="/profile/:username" element={<ContributorProfilePage />} />
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

// ── Admin layout (bypasses SiteLayout — has its own shell) ───────────────────
function AdminRoutes() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

// ── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <ToastProvider>
            <WalletProvider defaultNetwork="mainnet-beta">
              <Routes>
                {/* Admin section — own layout, no wallet/site shell needed */}
                <Route path="/admin/*" element={<AdminRoutes />} />
                {/* Everything else */}
                <Route path="/*" element={<AppLayout />} />
              </Routes>
            </WalletProvider>
            <ToastContainer />
          </ToastProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
