'use client';

import React from 'react';
import type { ContributorBadgeStats } from '../types/badges';
import { computeBadges } from '../types/badges';
import { BadgeGrid } from './badges';
import { TimeAgo } from './common/TimeAgo';

interface ContributorProfileProps {
  username: string;
  avatarUrl?: string;
  walletAddress?: string;
  totalEarned?: number;
  bountiesCompleted?: number;
  reputationScore?: number;
  /** Badge stats — if omitted, badge section is hidden. */
  badgeStats?: ContributorBadgeStats;
}

export const ContributorProfile: React.FC<ContributorProfileProps> = ({
  username,
  avatarUrl,
  walletAddress = '',
  totalEarned = 0,
  bountiesCompleted = 0,
  reputationScore = 0,
  badgeStats,
}) => {
  const truncatedWallet = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : 'Not connected';

  const badges = badgeStats ? computeBadges(badgeStats) : [];
  const earnedCount = badges.filter((b) => b.earned).length;
  
  // Get most recent PR timestamp
  const mostRecentPrTimestamp = badgeStats?.prSubmissionTimestampsUtc?.[badgeStats.prSubmissionTimestampsUtc.length - 1];

  return (
    <div className="bg-gray-900 rounded-lg p-4 sm:p-6 text-white space-y-6">
      {/* Profile Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-purple-500 flex items-center justify-center shrink-0 mx-auto sm:mx-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt={username} className="w-full h-full rounded-full" />
          ) : (
            <span className="text-2xl sm:text-3xl">{username.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="text-center sm:text-left flex-1">
          <h1 className="text-xl sm:text-2xl font-bold break-words">{username}</h1>
          <p className="text-gray-400 text-xs sm:text-sm font-mono">{truncatedWallet}</p>
        </div>

        {/* Badge count pill in header */}
        {badgeStats && (
          <div
            className="flex items-center gap-2 self-center sm:self-start"
            data-testid="header-badge-count"
          >
            <span className="text-lg" aria-hidden>🏅</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#9945FF]/20 to-[#14F195]/20 border border-purple-500/30 px-3 py-1 text-sm font-semibold text-white">
              {earnedCount}
              <span className="text-gray-400 font-normal text-xs">/ {badges.length}</span>
            </span>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-gray-800 rounded-lg p-3 sm:p-4">
          <p className="text-gray-400 text-xs sm:text-sm">Total Earned</p>
          <p className="text-lg sm:text-xl font-bold text-green-400">{totalEarned.toLocaleString()} FNDRY</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-3 sm:p-4">
          <p className="text-gray-400 text-xs sm:text-sm">Bounties</p>
          <p className="text-lg sm:text-xl font-bold text-purple-400">{bountiesCompleted}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-3 sm:p-4">
          <p className="text-gray-400 text-xs sm:text-sm">Reputation</p>
          <p className="text-lg sm:text-xl font-bold text-yellow-400">{reputationScore}</p>
        </div>
      </div>

      {/* Recent Activity */}
      {mostRecentPrTimestamp && (
        <div className="bg-gray-800/50 rounded-lg p-3 flex items-center justify-between">
          <span className="text-gray-400 text-xs">Last PR submitted</span>
          <TimeAgo date={mostRecentPrTimestamp} className="text-xs text-gray-300" />
        </div>
      )}

      {/* Achievements / Badge Grid */}
      {badgeStats && <BadgeGrid badges={badges} />}

      {/* Hire as Agent Button */}
      <button
        className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 sm:py-4 rounded-lg font-medium transition-colors disabled:opacity-50 min-h-[44px] touch-manipulation"
        disabled
      >
        Hire as Agent (Coming Soon)
      </button>
    </div>
  );
};

export default ContributorProfile;