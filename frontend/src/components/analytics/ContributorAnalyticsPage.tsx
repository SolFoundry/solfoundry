/**
 * ContributorAnalyticsPage - Detailed contributor analytics profile.
 *
 * Displays comprehensive contributor data including:
 * - Profile header with avatar, tier badge, and key stats
 * - Review score trend chart (Recharts line chart)
 * - Completion history table with on-chain verification links
 * - Tier progression timeline
 * - Completions breakdown by tier and category
 * - Activity heatmap
 *
 * Uses React Query via useContributorAnalytics hook.
 * Fully responsive with mobile-first design.
 * @module components/analytics/ContributorAnalyticsPage
 */

import { useParams, Link } from 'react-router-dom';
import { useContributorAnalytics } from '../../hooks/useAnalytics';
import { SkeletonCard } from '../common/Skeleton';
import { MetricCard } from './MetricCard';
import { ReviewScoreTrendChart, ActivityHeatmap } from './AnalyticsCharts';

/** Tier badge configuration. */
const TIER_CONFIG: Record<number, { label: string; color: string }> = {
  1: { label: 'Tier 1', color: 'bg-[#14F195]/20 text-[#14F195] border-[#14F195]/30' },
  2: { label: 'Tier 2', color: 'bg-[#9945FF]/20 text-[#9945FF] border-[#9945FF]/30' },
  3: { label: 'Tier 3', color: 'bg-[#FF6B35]/20 text-[#FF6B35] border-[#FF6B35]/30' },
};

/**
 * Contributor analytics profile page.
 *
 * Fetches and displays detailed analytics for a contributor identified
 * by the :username route parameter. Includes review score trends,
 * completion history, and tier progression data.
 */
export function ContributorAnalyticsPage() {
  const { username } = useParams<{ username: string }>();
  const { data: profile, isLoading, isError, error, refetch } = useContributorAnalytics(username);

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6" data-testid="contributor-analytics-page">
        <SkeletonCard showAvatar bodyLines={4} showFooter />
        <SkeletonCard bodyLines={6} />
      </div>
    );
  }

  if (isError) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to load contributor';
    return (
      <div className="p-4 sm:p-6 max-w-5xl mx-auto" data-testid="contributor-analytics-page">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center" role="alert">
          <p className="text-red-400 font-semibold mb-2">Failed to load contributor profile</p>
          <p className="text-sm text-gray-400 mb-4">{errorMessage}</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 rounded-lg bg-[#9945FF]/20 text-[#9945FF] hover:bg-[#9945FF]/30 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-4 sm:p-6 max-w-5xl mx-auto text-center text-gray-400" data-testid="contributor-analytics-page">
        Contributor not found.
      </div>
    );
  }

  const tierConfig = TIER_CONFIG[profile.tier] || TIER_CONFIG[1];

  // Build activity data for heatmap from completion history
  const activityData: Record<string, number> = {};
  for (const completion of profile.completionHistory) {
    if (completion.completedAt) {
      const dateStr = completion.completedAt.split('T')[0];
      activityData[dateStr] = (activityData[dateStr] || 0) + 1;
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6" data-testid="contributor-analytics-page">
      {/* Breadcrumb */}
      <nav className="text-xs text-gray-500" aria-label="Breadcrumb">
        <Link to="/analytics/leaderboard" className="hover:text-[#9945FF] transition-colors">
          Leaderboard
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-300">{profile.username}</span>
      </nav>

      {/* Profile header */}
      <div className="rounded-xl border border-gray-700 bg-[#111111] p-6">
        <div className="flex flex-col sm:flex-row items-start gap-4">
          {/* Avatar */}
          <img
            src={profile.avatarUrl || `https://avatars.githubusercontent.com/${profile.username}`}
            alt={`${profile.username} avatar`}
            className="h-20 w-20 rounded-full border-2 border-gray-700"
            width={80}
            height={80}
            loading="lazy"
          />

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-white">{profile.displayName || profile.username}</h1>
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${tierConfig.color}`}>
                {tierConfig.label}
              </span>
              {profile.onChainVerified && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#14F195]/10 text-[#14F195] border border-[#14F195]/20"
                  title="On-chain verified"
                >
                  On-chain Verified
                </span>
              )}
            </div>
            <p className="text-sm text-gray-400">@{profile.username}</p>
            {profile.bio && <p className="text-sm text-gray-300 mt-2">{profile.bio}</p>}

            {/* Skills */}
            {profile.topSkills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {profile.topSkills.map((skill) => (
                  <span
                    key={skill}
                    className="px-2 py-0.5 rounded-full text-[10px] bg-[#9945FF]/10 text-[#9945FF] border border-[#9945FF]/20"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            )}

            {/* Wallet */}
            {profile.walletAddress && (
              <p className="text-xs text-gray-500 mt-2 font-mono truncate">
                Wallet: {profile.walletAddress}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          label="Total Earned"
          value={`${profile.totalEarned.toLocaleString()} FNDRY`}
          icon="\uD83D\uDCB0"
          testId="metric-total-earned"
        />
        <MetricCard
          label="Bounties Done"
          value={profile.bountiesCompleted}
          icon="\u2705"
          testId="metric-bounties-done"
        />
        <MetricCard
          label="Quality Score"
          value={profile.qualityScore.toFixed(1)}
          icon="\u2B50"
          testId="metric-quality-score"
        />
        <MetricCard
          label="Streak"
          value={`${profile.streakDays} days`}
          icon="\uD83D\uDD25"
          testId="metric-streak"
        />
      </div>

      {/* Review Score Trend */}
      <section className="rounded-xl border border-gray-700 bg-[#111111] p-5">
        <h2 className="text-lg font-semibold text-white mb-4">Review Score Trend</h2>
        <ReviewScoreTrendChart data={profile.reviewScoreTrend} height={250} />
      </section>

      {/* Activity Heatmap */}
      <section className="rounded-xl border border-gray-700 bg-[#111111] p-5">
        <h2 className="text-lg font-semibold text-white mb-4">Activity</h2>
        <ActivityHeatmap activityData={activityData} weeks={12} />
      </section>

      {/* Tier Progression */}
      {profile.tierProgression.length > 0 && (
        <section className="rounded-xl border border-gray-700 bg-[#111111] p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Tier Progression</h2>
          <div className="flex flex-wrap gap-4">
            {profile.tierProgression.map((milestone) => {
              const config = TIER_CONFIG[milestone.tier] || TIER_CONFIG[1];
              return (
                <div
                  key={milestone.tier}
                  className={`flex-1 min-w-[140px] rounded-lg border p-4 ${config.color}`}
                >
                  <p className="text-sm font-semibold mb-1">Tier {milestone.tier}</p>
                  <p className="text-xs opacity-80">
                    {milestone.qualifyingBounties} qualifying bounties
                  </p>
                  <p className="text-xs opacity-60 mt-1">
                    Avg score: {milestone.averageScoreAtAchievement.toFixed(1)}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Completions by Tier/Category */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* By Tier */}
        <section className="rounded-xl border border-gray-700 bg-[#111111] p-5">
          <h2 className="text-sm font-semibold text-white mb-3">Completions by Tier</h2>
          {Object.keys(profile.completionsByTier).length === 0 ? (
            <p className="text-xs text-gray-500">No completions yet</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(profile.completionsByTier).map(([tier, count]) => (
                <div key={tier} className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 capitalize">{tier.replace('-', ' ')}</span>
                  <span className="text-xs font-semibold text-white">{count}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* By Category */}
        <section className="rounded-xl border border-gray-700 bg-[#111111] p-5">
          <h2 className="text-sm font-semibold text-white mb-3">Completions by Category</h2>
          {Object.keys(profile.completionsByCategory).length === 0 ? (
            <p className="text-xs text-gray-500">No completions yet</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(profile.completionsByCategory).map(([category, count]) => (
                <div key={category} className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 capitalize">{category}</span>
                  <span className="text-xs font-semibold text-white">{count}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Completion History */}
      {profile.completionHistory.length > 0 && (
        <section className="rounded-xl border border-gray-700 bg-[#111111] p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Completion History</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="table" aria-label="Bounty completion history">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400 text-left text-xs">
                  <th className="py-2">Bounty</th>
                  <th className="py-2 text-center">Tier</th>
                  <th className="py-2 text-right">Score</th>
                  <th className="py-2 text-right">Reward</th>
                  <th className="py-2 text-right hidden sm:table-cell">Date</th>
                  <th className="py-2 text-center hidden md:table-cell">Verified</th>
                </tr>
              </thead>
              <tbody>
                {profile.completionHistory.map((record) => (
                  <tr key={record.bountyId} className="border-b border-gray-800">
                    <td className="py-2.5 text-white truncate max-w-[200px]">
                      {record.bountyTitle}
                    </td>
                    <td className="py-2.5 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${TIER_CONFIG[record.tier]?.color || TIER_CONFIG[1].color}`}>
                        T{record.tier}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      <span className={`font-semibold ${
                        record.reviewScore >= 8 ? 'text-[#14F195]'
                          : record.reviewScore >= 6 ? 'text-yellow-400'
                          : 'text-gray-400'
                      }`}>
                        {record.reviewScore.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-2.5 text-right text-[#14F195]">
                      {record.rewardAmount.toLocaleString()}
                    </td>
                    <td className="py-2.5 text-right text-gray-400 text-xs hidden sm:table-cell">
                      {record.completedAt
                        ? new Date(record.completedAt).toLocaleDateString()
                        : '-'}
                    </td>
                    <td className="py-2.5 text-center hidden md:table-cell">
                      {record.onChainTxHash ? (
                        <a
                          href={`https://solscan.io/tx/${record.onChainTxHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#14F195] hover:underline text-xs"
                          aria-label={`View transaction ${record.onChainTxHash.slice(0, 8)} on Solana explorer`}
                        >
                          View TX
                        </a>
                      ) : (
                        <span className="text-gray-600 text-xs">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Badges */}
      {profile.badges.length > 0 && (
        <section className="rounded-xl border border-gray-700 bg-[#111111] p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Badges</h2>
          <div className="flex flex-wrap gap-2">
            {profile.badges.map((badge) => (
              <span
                key={badge}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#9945FF]/10 text-[#9945FF] border border-[#9945FF]/20"
              >
                {badge}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default ContributorAnalyticsPage;
