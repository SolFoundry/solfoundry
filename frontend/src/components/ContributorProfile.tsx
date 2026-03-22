'use client';

import React, { useState } from 'react';
import type { ContributorBadgeStats } from '../types/badges';
import { computeBadges } from '../types/badges';
import { BadgeGrid } from './badges';
import { TierProgressBar } from './common/TierProgressBar';
import { TierBadge } from './bounties/TierBadge';
import type { BountyTier } from '../types/bounty';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RecentBounty {
  id: string;
  title: string;
  tier: BountyTier;
  reward: number;
  completedAt: string;
}

interface ContributorProfileProps {
  username: string;
  avatarUrl?: string;
  walletAddress?: string;
  joinDate?: string;
  totalEarned?: number;
  bountiesCompleted?: number;
  completedT1?: number;
  completedT2?: number;
  completedT3?: number;
  reputationScore?: number;
  recentBounties?: RecentBounty[];
  /** Badge stats — if omitted, badge section is hidden. */
  badgeStats?: ContributorBadgeStats;
}

// ── Wallet copy button ────────────────────────────────────────────────────────

function WalletAddressRow({ walletAddress }: { walletAddress: string }) {
  const [copied, setCopied] = useState(false);

  if (!walletAddress) {
    return <p className="text-gray-400 text-xs sm:text-sm font-mono">Not connected</p>;
  }

  const truncated = `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`;

  function handleCopy() {
    navigator.clipboard.writeText(walletAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-400 text-xs sm:text-sm font-mono" title={walletAddress}>
        {truncated}
      </span>
      <button
        onClick={handleCopy}
        aria-label="Copy wallet address"
        className="text-gray-500 hover:text-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-[#9945FF]/50 rounded"
        data-testid="copy-wallet-btn"
      >
        {copied ? (
          <svg className="w-3.5 h-3.5 text-[#14F195]" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
          </svg>
        )}
      </button>
    </div>
  );
}

// ── Recent bounties list ──────────────────────────────────────────────────────

function RecentActivity({ bounties }: { bounties: RecentBounty[] }) {
  if (bounties.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 text-center text-gray-500 text-sm">
        No completed bounties yet.
      </div>
    );
  }

  return (
    <ul className="space-y-2" data-testid="recent-activity-list">
      {bounties.map((b) => (
        <li key={b.id} className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3 gap-3 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <TierBadge tier={b.tier} />
            <a
              href={`/bounties/${b.id}`}
              className="text-sm text-gray-200 hover:text-white truncate transition-colors"
            >
              {b.title}
            </a>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs text-green-400 font-mono font-semibold">
              +{b.reward.toLocaleString()} FNDRY
            </span>
            <span className="text-xs text-gray-500 hidden sm:block">
              {new Date(b.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export const ContributorProfile: React.FC<ContributorProfileProps> = ({
  username,
  avatarUrl,
  walletAddress = '',
  joinDate,
  totalEarned = 0,
  bountiesCompleted = 0,
  completedT1 = 0,
  completedT2 = 0,
  completedT3 = 0,
  reputationScore = 0,
  recentBounties = [],
  badgeStats,
}) => {
  const badges = badgeStats ? computeBadges(badgeStats) : [];
  const earnedCount = badges.filter((b) => b.earned).length;

  const joinDateFormatted = joinDate
    ? new Date(joinDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="bg-gray-900 rounded-lg p-4 sm:p-6 text-white space-y-6">
      {/* Profile Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-purple-500 flex items-center justify-center shrink-0 mx-auto sm:mx-0 overflow-hidden">
          {avatarUrl ? (
            <img src={avatarUrl} alt={username} className="w-full h-full rounded-full object-cover" />
          ) : (
            <span className="text-2xl sm:text-3xl">{username.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="text-center sm:text-left flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold break-words">{username}</h1>
          <div className="flex items-center justify-center sm:justify-start gap-2 mt-1">
            <WalletAddressRow walletAddress={walletAddress} />
          </div>
          {joinDateFormatted && (
            <p className="text-gray-500 text-xs mt-1">Joined {joinDateFormatted}</p>
          )}
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-gray-800 rounded-lg p-3 sm:p-4">
          <p className="text-gray-400 text-xs sm:text-sm">Total Earned</p>
          <p className="text-lg sm:text-xl font-bold text-green-400">{totalEarned.toLocaleString()} FNDRY</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-3 sm:p-4">
          <p className="text-gray-400 text-xs sm:text-sm">Reputation</p>
          <p className="text-lg sm:text-xl font-bold text-yellow-400">{reputationScore}</p>
        </div>
        {/* T1/T2/T3 breakdown */}
        <div className="bg-gray-800 rounded-lg p-3 sm:p-4 col-span-2 sm:col-span-2" data-testid="bounty-tier-breakdown">
          <p className="text-gray-400 text-xs sm:text-sm mb-2">Bounties Completed</p>
          <div className="flex items-center gap-3">
            <span className="text-lg sm:text-xl font-bold text-purple-400">{bountiesCompleted}</span>
            <div className="flex gap-2 text-xs font-mono">
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-[#14F195]" />
                <span className="text-gray-400">T1:</span>
                <span className="text-gray-200 font-semibold">{completedT1}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-[#FFD700]" />
                <span className="text-gray-400">T2:</span>
                <span className="text-gray-200 font-semibold">{completedT2}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-[#FF6B6B]" />
                <span className="text-gray-400">T3:</span>
                <span className="text-gray-200 font-semibold">{completedT3}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tier Progress Bar */}
      <div className="bg-gray-800 rounded-lg p-4 sm:p-5" data-testid="tier-progress-section">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Tier Progress</h2>
        <TierProgressBar
          completedT1={completedT1}
          completedT2={completedT2}
          completedT3={completedT3}
        />
      </div>

      {/* Recent Activity */}
      <div data-testid="recent-activity-section">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Recent Activity</h2>
        <RecentActivity bounties={recentBounties} />
      </div>

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
