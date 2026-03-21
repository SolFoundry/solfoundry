'use client';

import React from 'react';
import { BadgeGrid } from './badges';
import { useBadges } from '../hooks/useBadges';
import type { ContributorStats } from '../types/badge';

interface ContributorProfileProps {
  username: string;
  avatarUrl?: string;
  walletAddress?: string;
  totalEarned?: number;
  bountiesCompleted?: number;
  reputationScore?: number;
  /** Contributor stats for badge computation */
  contributorStats?: ContributorStats;
}

export const ContributorProfile: React.FC<ContributorProfileProps> = ({
  username,
  avatarUrl,
  walletAddress = '',
  totalEarned = 0,
  bountiesCompleted = 0,
  reputationScore = 0,
  contributorStats,
}) => {
  const truncatedWallet = walletAddress 
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : 'Not connected';

  // Compute badges from contributor stats
  const badges = useBadges(contributorStats ?? null);
  const earnedBadgeCount = badges.filter(b => b.earned).length;
  const totalBadges = badges.length;

  return (
    <div className="bg-gray-900 rounded-lg p-4 sm:p-6 text-white">
      {/* Profile Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-purple-500 flex items-center justify-center shrink-0 mx-auto sm:mx-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt={username} className="w-full h-full rounded-full" />
          ) : (
            <span className="text-2xl sm:text-3xl">{username.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="text-center sm:text-left">
          <h1 className="text-xl sm:text-2xl font-bold break-words">{username}</h1>
          <p className="text-gray-400 text-xs sm:text-sm font-mono">{truncatedWallet}</p>
        </div>
      </div>

      {/* Stats Cards - Responsive grid (now 4 columns with badge count) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
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
        {/* Badge Count Card */}
        <div className="bg-gray-800 rounded-lg p-3 sm:p-4">
          <p className="text-gray-400 text-xs sm:text-sm">Badges</p>
          <p className="text-lg sm:text-xl font-bold text-[#14F195]">{earnedBadgeCount}/{totalBadges}</p>
        </div>
      </div>

      {/* Badge Grid Section */}
      {badges.length > 0 && (
        <div className="mb-6 pt-4 border-t border-gray-800">
          <BadgeGrid badges={badges} columns={4} />
        </div>
      )}

      {/* Hire as Agent Button - Touch friendly (min 44px height) */}
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