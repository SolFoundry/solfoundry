import React from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { AnalyticsLeaderboardPage } from '../components/analytics/AnalyticsLeaderboardPage';
import { BountyAnalyticsPage } from '../components/analytics/BountyAnalyticsPage';
import { PlatformHealthPage } from '../components/analytics/PlatformHealthPage';
import { ContributorAnalyticsPage } from '../components/analytics/ContributorAnalyticsPage';

const NAV_ITEMS = [
  { label: 'Leaderboard',     path: 'leaderboard' },
  { label: 'Bounties',        path: 'bounties' },
  { label: 'Platform Health', path: 'platform' },
];

export function AnalyticsDashboardPage() {
  return (
    <div className="min-h-screen bg-[#0a0a14] text-white">
      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-1">Analytics</h1>
          <p className="text-white/50 text-sm">
            Bounty trends, payout distribution, contributor growth, and engagement metrics.
          </p>
        </div>

        {/* Sub-nav */}
        <nav className="flex gap-1 mb-8 border-b border-white/10 pb-0">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  isActive
                    ? 'border-[#14F195] text-[#14F195]'
                    : 'border-transparent text-white/50 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Sub-routes */}
        <Routes>
          <Route index element={<Navigate to="leaderboard" replace />} />
          <Route path="leaderboard" element={<AnalyticsLeaderboardPage />} />
          <Route path="bounties" element={<BountyAnalyticsPage />} />
          <Route path="platform" element={<PlatformHealthPage />} />
          <Route path="contributors/:username" element={<ContributorAnalyticsPage />} />
        </Routes>
      </div>
    </div>
  );
}
