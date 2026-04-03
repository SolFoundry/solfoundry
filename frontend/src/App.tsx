/**
 * App — Root component with full routing and layout.
 * All pages wrapped in ThemeProvider + WalletProvider + SiteLayout.
 * @module App
 */
import React, { lazy, Suspense, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletProvider, WalletModal } from './components/wallet';
import { SiteLayout } from './components/layout/SiteLayout';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuthContext } from './contexts/AuthContext';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './services/queryClient';
import { ToastProvider } from './contexts/ToastContext';
import { ToastContainer } from './components/common/ToastContainer';
import { SolFoundryLogoMark } from './components/common/SolFoundryLogoMark';
import { ErrorBoundary } from './components/ErrorBoundary';

// ErrorBoundary is imported from ./components/ErrorBoundary


// ── Lazy-loaded page components ──────────────────────────────────────────────
const BountiesPage = lazy(() => import('./pages/BountiesPage'));
const BountyDetailPage = lazy(() => import('./pages/BountyDetailPage'));
const BountyCreatePage = lazy(() => import('./pages/BountyCreatePage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
// TokenomicsPage removed in Phase 2 refactor
const ContributorProfilePage = lazy(() => import('./pages/ContributorProfilePage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const CreatorDashboardPage = lazy(() => import('./pages/CreatorDashboardPage'));
const HowItWorksPage = lazy(() => import('./pages/HowItWorksPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const GitHubCallbackPage = lazy(() => import('./pages/GitHubCallbackPage'));

// ── Auth flow components (must be at module level to avoid remounting) ────────
const WalletAuthFlow = lazy(() => import('./components/auth/WalletAuthFlow').then(m => ({ default: m.WalletAuthFlow })));
const GitHubLinkPrompt = lazy(() => import('./components/auth/GitHubLinkPrompt').then(m => ({ default: m.GitHubLinkPrompt })));

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
  return (
    <AuthProvider>
      <AppLayoutInner />
    </AuthProvider>
  );
}

function AppLayoutInner() {
  const location = useLocation();
  const { publicKey, disconnect, connecting } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;
  const [walletModalOpen, setWalletModalOpen] = useState(false);

  // Read auth context for user info to pass to SiteLayout
  const { user, logout } = useAuthContext();

  return (
    <SiteLayout
      currentPath={location.pathname}
      walletAddress={walletAddress}
      onConnectWallet={() => setWalletModalOpen(true)}
      onDisconnectWallet={() => { logout(); disconnect().catch(console.error); }}
      isConnecting={connecting}
      userName={user?.github_id ? user.username : undefined}
      avatarUrl={user?.avatar_url ?? undefined}
    >
      <WalletModal open={walletModalOpen} onClose={() => setWalletModalOpen(false)} />
      <Suspense fallback={null}>
        <WalletAuthFlow />
        {walletAddress && <GitHubLinkPrompt />}
      </Suspense>
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

          {/* How It Works */}
          <Route path="/how-it-works" element={<HowItWorksPage />} />

          {/* Contributor and Creator */}
          <Route path="/contributor/:username" element={<ContributorProfilePage />} />
          <Route path="/profile/:username" element={<ContributorProfilePage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/creator" element={<CreatorDashboardPage />} />

          {/* Auth */}
          <Route path="/auth/github/callback" element={<GitHubCallbackPage />} />

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
        <ThemeProvider>
          <ToastProvider>
            <WalletProvider defaultNetwork="mainnet-beta">
              <Routes>
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
