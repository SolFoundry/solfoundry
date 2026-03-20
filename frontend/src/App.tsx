/**
 * App - Root component with route definitions.
 * @module App
 */
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const AgentMarketplacePage = lazy(() => import('./pages/AgentMarketplacePage'));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="p-8 text-center text-gray-400">Loading...</div>}>
        <Routes>
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/marketplace" element={<AgentMarketplacePage />} />
          <Route path="*" element={<Navigate to="/leaderboard" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
