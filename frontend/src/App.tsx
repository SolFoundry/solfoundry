import React, { Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthGuard } from './components/auth/AuthGuard';

// Lazy load pages
const HomePage = React.lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const BountyDetailPage = React.lazy(() => import('./pages/BountyDetailPage').then((m) => ({ default: m.BountyDetailPage })));
const BountyCreatePage = React.lazy(() => import('./pages/BountyCreatePage').then((m) => ({ default: m.BountyCreatePage })));
const LeaderboardPage = React.lazy(() => import('./pages/LeaderboardPage').then((m) => ({ default: m.LeaderboardPage })));
const HowItWorksPage = React.lazy(() => import('./pages/HowItWorksPage').then((m) => ({ default: m.HowItWorksPage })));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const GitHubCallbackPage = React.lazy(() => import('./pages/GitHubCallbackPage').then((m) => ({ default: m.GitHubCallbackPage })));
const BountiesPage = React.lazy(() => import('./pages/BountiesPage').then((m) => ({ default: m.BountiesPage })));
const NotFoundPage = React.lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));
const EnhancePage = React.lazy(() => import('./pages/EnhancePage').then((m) => ({ default: m.EnhancePage })));

function PageLoader() {
  return (
    <div className="min-h-screen bg-forge-950 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-emerald border-t-transparent animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route
          path="/profile"
          element={
            <AuthGuard>
              <ProfilePage />
            </AuthGuard>
          }
        />
        <Route
          path="/bounties/create"
          element={
            <AuthGuard>
              <BountyCreatePage />
            </AuthGuard>
          }
        />
        <Route path="/bounties" element={<BountiesPage />} />
        <Route path="/bounties/:id" element={<BountyDetailPage />} />
        <Route path="/auth/github/callback" element={<GitHubCallbackPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
