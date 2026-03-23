'use client';

import React from 'react';
import type { ContributorBadgeStats } from '../types/badges';
import { computeBadges } from '../types/badges';
import { BadgeGrid } from './badges';
import { TimeAgo } from './common/TimeAgo';
import { WalletAddress } from './wallet/WalletAddress';

interface RecentBounty {
  title: string;
  issueUrl: string;
  tier: 1 | 2 | 3;
  earned: number;
  completedAt: string;
}

interface ContributorProfileProps {
  username: string;
  avatarUrl?: string;
  walletAddress?: string;
  totalEarned?: number;
  bountiesCompleted?: number;
  reputationScore?: number;
  /** Badge stats — if omitted, badge section is hidden. */
  badgeStats?: ContributorBadgeStats;
  /** Date when the contributor joined (ISO string). */
  joinDate?: string;
  /** Contributor tier level based on completed bounties. */
  tier?: 1 | 2 | 3;
  /** Number of Tier 1 bounties completed. */
  t1Completed?: number;
  /** Number of Tier 2 bounties completed. */
  t2Completed?: number;
  /** Number of Tier 3 bounties completed. */
  t3Completed?: number;
  /** Recently completed bounties for the activity feed. */
  recentBounties?: RecentBounty[];
}

const TIER_COLORS: Record<number, { bg: string; text: string; label: string }> = {
  1: { bg: 'bg-amber-700/20', text: 'text-amber-500', label: 'Tier 1' },
  2: { bg: 'bg-gray-300/20', text: 'text-gray-300', label: 'Tier 2' },
  3: { bg: 'bg-yellow-400/20', text: 'text-yellow-400', label: 'Tier 3' },
};

function TierBadge({ tier }: { tier: 1 | 2 | 3 }) {
  const style = TIER_COLORS[tier];
  return (
    <span
      data-testid="tier-badge"
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.bg} ${style.text}`}
    >
      {tier === 3 ? '🥇' : tier === 2 ? '🥈' : '🥉'} {style.label}
    </span>
  );
}

function TierProgressBar({
  tier,
  t1Completed,
  t2Completed,
}: {
  tier: 1 | 2 | 3;
  t1Completed: number;
  t2Completed: number;
}) {
  let current: number;
  let target: number;
  let label: string;

  if (tier >= 3) {
    return (
      <div data-testid="tier-progress" className="bg-gray-800 rounded-lg p-3">
        <p className="text-xs text-gray-400">Max tier reached 🎉</p>
      </div>
    );
  }

  if (tier === 1) {
    current = t1Completed;
    target = 4;
    label = `${current}/${target} T1 bounties toward Tier 2 access`;
  } else {
    current = t2Completed;
    target = 2;
    label = `${current}/${target} T2 bounties toward Tier 3 access`;
  }

  const pct = Math.min((current / target) * 100, 100);

  return (
    <div data-testid="tier-progress" className="bg-gray-800 rounded-lg p-3 space-y-2">
      <div className="flex justify-between items-center">
        <p className="text-xs text-gray-400">Tier Progress</p>
        <p className="text-xs text-gray-300">{label}</p>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div
          className="bg-purple-500 h-2 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function formatJoinDate(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '';
  const month = d.toLocaleString('en-US', { month: 'long' });
  return `Member since ${month} ${d.getFullYear()}`;
}

function tierLabel(tier: 1 | 2 | 3): string {
  return `T${tier}`;
}

export const ContributorProfile: React.FC<ContributorProfileProps> = ({
  username,
  avatarUrl,
  walletAddress = '',
  totalEarned = 0,
  bountiesCompleted = 0,
  reputationScore = 0,
  badgeStats,
  joinDate,
  tier,
  t1Completed = 0,
  t2Completed = 0,
  t3Completed = 0,
  recentBounties,
}) => {
  const badges = badgeStats ? computeBadges(badgeStats) : [];
  const earnedCount = badges.filter((b) => b.earned).length;

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
          <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold break-words">{username}</h1>
            {tier && <TierBadge tier={tier} />}
          </div>
          <div className="flex items-center gap-1.5 justify-center sm:justify-start" data-testid="copy-wallet-btn">
            {walletAddress ? (
              <WalletAddress address={walletAddress} startChars={6} endChars={4} className="text-xs sm:text-sm" />
            ) : (
              <p className="text-gray-400 text-xs sm:text-sm font-mono">Not connected</p>
            )}
          </div>
          {joinDate && (
            <p data-testid="join-date" className="text-gray-500 text-xs mt-1">
              {formatJoinDate(joinDate)}
            </p>
          )}
        </div>

        {/* Badge count pill in header */}
        {badgeStats && (
          <div
            className="flex items-center gap-2 self-center sm:self-start"
            data-testid="header-badge-count"
          >
            <span className="text-lg" aria-hidden>🏅</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-solana-purple/20 to-solana-green/20 border border-solana-purple/30 px-3 py-1 text-sm font-semibold text-gray-900 dark:text-white">
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

      {/* T1/T2/T3 Breakdown */}
      {(t1Completed > 0 || t2Completed > 0 || t3Completed > 0) && (
        <div data-testid="tier-breakdown" className="grid grid-cols-3 gap-3">
          <div className="bg-gray-800/60 rounded-lg p-3 text-center">
            <p className="text-xs text-amber-500 font-medium">T1</p>
            <p className="text-lg font-bold text-white">{t1Completed}</p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-300 font-medium">T2</p>
            <p className="text-lg font-bold text-white">{t2Completed}</p>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-3 text-center">
            <p className="text-xs text-yellow-400 font-medium">T3</p>
            <p className="text-lg font-bold text-white">{t3Completed}</p>
          </div>
        </div>
      )}

      {/* Tier Progress Bar */}
      {tier && tier < 3 && (
        <TierProgressBar tier={tier} t1Completed={t1Completed} t2Completed={t2Completed} />
      )}
      {tier && tier >= 3 && (
        <TierProgressBar tier={tier} t1Completed={t1Completed} t2Completed={t2Completed} />
      )}

      {/* Recent Activity */}
      {mostRecentPrTimestamp && (
        <div className="bg-gray-800/50 rounded-lg p-3 flex items-center justify-between">
          <span className="text-gray-400 text-xs">Last PR submitted</span>
          <TimeAgo date={mostRecentPrTimestamp} className="text-xs text-gray-300" />
        </div>
      )}

      {/* Recent Bounties Activity Feed */}
      {recentBounties && recentBounties.length > 0 && (
        <div data-testid="recent-bounties" className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-300">Recent Activity</h2>
          <div className="space-y-2">
            {recentBounties.map((bounty, idx) => (
              <a
                key={idx}
                href={bounty.issueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-gray-800/50 hover:bg-gray-800 rounded-lg p-3 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{bounty.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {tierLabel(bounty.tier)} · {bounty.earned.toLocaleString()} FNDRY · {new Date(bounty.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <span className={`text-xs font-medium ${TIER_COLORS[bounty.tier].text}`}>
                    {tierLabel(bounty.tier)}
                  </span>
                </div>
              </a>
            ))}
          </div>
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
