import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { ContributorProfile } from '../../types/contributor';
import { TierBadge } from '../bounties/TierBadge';
import { TierProgressBar } from '../common/TierProgressBar';
import { WalletAddress } from '../wallet/WalletAddress';
import { AgentStatsCard } from '../agents/AgentStatsCard';

function formatDate(dateStr: string): string {
  if (!dateStr) return 'Unknown';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

function formatShortDate(dateStr: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface ContributorProfileViewProps {
  contributor: ContributorProfile;
}

export function ContributorProfileView({ contributor }: ContributorProfileViewProps) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const joinDate = useMemo(() => formatDate(contributor.joinedAt), [contributor.joinedAt]);

  const recentBounties = useMemo(
    () => contributor.recentBounties.slice(0, 10),
    [contributor.recentBounties],
  );

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Back link */}
      <Link
        to="/leaderboard"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-solana-green transition-colors mb-6"
      >
        &larr; Back to Leaderboard
      </Link>

      {/* Header Card */}
      <div className="rounded-xl border border-surface-300 bg-surface-50 p-5 sm:p-8 mb-6">
        <div className="flex flex-col sm:flex-row gap-5">
          <div className="flex flex-col items-center sm:items-start">
            <div className="h-20 w-20 rounded-full bg-surface-200 overflow-hidden shrink-0 flex items-center justify-center">
              {avatarFailed ? (
                <span className="text-2xl font-bold text-gray-400">
                  {contributor.username.charAt(0).toUpperCase()}
                </span>
              ) : (
                <img
                  src={contributor.avatarUrl}
                  alt={`${contributor.username}'s avatar`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  onError={() => setAvatarFailed(true)}
                />
              )}
            </div>
          </div>

          <div className="flex-1 text-center sm:text-left min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-white break-words">
                {contributor.username}
              </h1>
              <TierBadge tier={contributor.tier} />
            </div>
            <p className="text-sm text-gray-400 mb-3">Joined {joinDate}</p>

            {contributor.walletAddress ? (
              <WalletAddress address={contributor.walletAddress} />
            ) : (
              <span className="text-sm text-gray-500 font-mono">No wallet connected</span>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <AgentStatsCard
          label="Bounties"
          value={contributor.bountiesCompleted.toString()}
          icon={<span className="text-solana-green">&#9889;</span>}
          accent="text-solana-green"
        />
        <AgentStatsCard
          label="Reputation"
          value={contributor.reputationScore.toString()}
          icon={<span className="text-accent-gold">&#9733;</span>}
          accent="text-accent-gold"
        />
        <AgentStatsCard
          label="Total Earned"
          value={`${contributor.totalEarnedFndry.toLocaleString()} $FNDRY`}
          icon={<span className="text-solana-purple">&#9670;</span>}
          accent="text-solana-purple"
        />
        <AgentStatsCard
          label="By Tier"
          value={`${contributor.completedT1} / ${contributor.completedT2} / ${contributor.completedT3}`}
          icon={<span className="text-[#14F195]">T</span>}
          accent="text-gray-300"
        />
      </div>

      {/* Tier Progress */}
      <div className="rounded-xl border border-surface-300 bg-surface-50 p-5 sm:p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
          Tier Progress
        </h3>
        <TierProgressBar
          completedT1={contributor.completedT1}
          completedT2={contributor.completedT2}
          completedT3={contributor.completedT3}
        />
      </div>

      {/* Recent Activity */}
      <div className="rounded-xl border border-surface-300 bg-surface-50 p-5 sm:p-6">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
          Recent Activity
        </h3>

        {recentBounties.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            No completed bounties yet.
          </p>
        ) : (
          <div className="space-y-0">
            {recentBounties.map((bounty, idx) => (
              <div key={bounty.id} className="relative flex gap-4 pb-6 last:pb-0">
                {idx < recentBounties.length - 1 && (
                  <div className="absolute left-[7px] top-4 bottom-0 w-px bg-surface-300" />
                )}

                <div className="relative z-10 mt-1.5 h-[15px] w-[15px] shrink-0 rounded-full border-2 border-solana-green bg-surface" />

                <div className="min-w-0 flex-1 rounded-lg border border-surface-300 bg-surface-50 p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3 mb-1">
                    <Link
                      to={`/bounties/${bounty.id}`}
                      className="text-sm font-medium text-white truncate hover:text-solana-green transition-colors"
                    >
                      {bounty.title}
                    </Link>
                    <span className="text-xs text-gray-500 shrink-0">
                      {formatShortDate(bounty.completedAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <TierBadge tier={bounty.tier} />
                    <span className="text-xs text-solana-green font-medium">
                      +{bounty.reward.toLocaleString()} {bounty.currency}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}