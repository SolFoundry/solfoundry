'use client';

import React from 'react';

interface ContributorProfileProps {
  username: string;
  avatarUrl?: string;
  walletAddress?: string;
  totalEarned?: number;
  bountiesCompleted?: number;
  reputationScore?: number;
}

export const ContributorProfile: React.FC<ContributorProfileProps> = ({
  username,
  avatarUrl,
  walletAddress = '',
  totalEarned = 0,
  bountiesCompleted = 0,
  reputationScore = 0,
}) => {
  const truncatedWallet = walletAddress 
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : 'Not connected';

  return (
    <div className="bg-gray-900 rounded-lg p-6 text-white">
      {/* Profile Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full bg-purple-500 flex items-center justify-center">
          {avatarUrl ? (
            <img src={avatarUrl} alt={username} className="w-full h-full rounded-full" />
          ) : (
            <span className="text-2xl">{username.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{username}</h1>
          <p className="text-gray-400 text-sm font-mono">{truncatedWallet}</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-gray-400 text-sm">Total Earned</p>
          <p className="text-xl font-bold text-green-400">{totalEarned.toLocaleString()} FNDRY</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-gray-400 text-sm">Bounties</p>
          <p className="text-xl font-bold text-purple-400">{bountiesCompleted}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-gray-400 text-sm">Reputation</p>
          <p className="text-xl font-bold text-yellow-400">{reputationScore}</p>
        </div>
      </div>

      {/* Hire as Agent Button (placeholder) */}
      <button 
        className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
        disabled
      >
        Hire as Agent (Coming Soon)
      </button>
    </div>
  );
};

export default ContributorProfile;