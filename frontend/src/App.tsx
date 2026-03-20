/**
 * App - Root component with route definitions.
 * Mounts the leaderboard page at /leaderboard via lazy-loaded import.
 * All other paths redirect to the leaderboard as the default view.
 * @module App
 */
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const CreateBountyPage = lazy(() => import('./pages/CreateBountyPage'));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="p-8 text-center text-gray-400">Loading...</div>}>
        <Routes>
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/bounties/create" element={<CreateBountyPage />} />
          <Route path="*" element={<Navigate to="/leaderboard" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
