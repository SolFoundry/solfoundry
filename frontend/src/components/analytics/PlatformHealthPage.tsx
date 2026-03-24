/**
 * PlatformHealthPage - Platform-wide health metrics and growth dashboard.
 *
 * Displays:
 * - Key platform metrics (contributors, bounties, payouts)
 * - Growth trend chart (Recharts line chart)
 * - Bounties by status breakdown
 * - Top categories ranked by volume
 *
 * Uses React Query via usePlatformHealth hook.
 * Fully responsive with dark/light theme support.
 * @module components/analytics/PlatformHealthPage
 */

import { useState } from 'react';
import { usePlatformHealth } from '../../hooks/useAnalytics';
import { SkeletonCard } from '../common/Skeleton';
import { MetricCard } from './MetricCard';
import { GrowthTrendChart } from './AnalyticsCharts';
import type { AnalyticsTimeRange } from '../../types/analytics';

/** Time range options for platform health. */
const TIME_RANGES: { label: string; value: AnalyticsTimeRange }[] = [
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
  { label: 'All time', value: 'all' },
];

/** Status display configuration. */
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open: { label: 'Open', color: 'bg-blue-500/20 text-blue-400' },
  in_progress: { label: 'In Progress', color: 'bg-[#9945FF]/20 text-[#9945FF]' },
  under_review: { label: 'Under Review', color: 'bg-yellow-500/20 text-yellow-400' },
  completed: { label: 'Completed', color: 'bg-[#14F195]/20 text-[#14F195]' },
  paid: { label: 'Paid', color: 'bg-[#14F195]/20 text-[#14F195]' },
  disputed: { label: 'Disputed', color: 'bg-red-500/20 text-red-400' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-500/20 text-gray-400' },
  draft: { label: 'Draft', color: 'bg-gray-500/20 text-gray-400' },
};

/**
 * Platform health dashboard page.
 *
 * Renders aggregate metrics, growth charts, status breakdowns,
 * and top category rankings for the SolFoundry platform.
 */
export function PlatformHealthPage() {
  const [timeRange, setTimeRange] = useState<AnalyticsTimeRange>('30d');
  const { data, isLoading, isError, error } = usePlatformHealth(timeRange);

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6" data-testid="platform-health-page">
        <div className="h-8 w-48 bg-surface-200 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonCard key={i} bodyLines={2} />
          ))}
        </div>
        <SkeletonCard bodyLines={10} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 sm:p-6 max-w-6xl mx-auto" data-testid="platform-health-page">
        <div className="text-center text-red-400 py-8" role="alert">
          Error: {error instanceof Error ? error.message : 'Failed to load platform health'}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6" data-testid="platform-health-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Platform Health</h1>
        <p className="text-sm text-gray-400 mt-1">
          Real-time metrics, growth trends, and platform activity
        </p>
      </div>

      {/* Time range filter */}
      <div className="flex gap-1" role="group" aria-label="Time range filter">
        {TIME_RANGES.map((range) => (
          <button
            key={range.value}
            onClick={() => setTimeRange(range.value)}
            aria-pressed={timeRange === range.value}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              timeRange === range.value
                ? 'bg-[#14F195] text-black'
                : 'bg-[#111111] text-gray-300 border border-gray-700 hover:border-gray-500'
            }`}
          >
            {range.label}
          </button>
        ))}
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          label="Contributors"
          value={data.totalContributors}
          change={data.activeContributors > 0 ? `${data.activeContributors} active` : undefined}
          changePositive={true}
          icon="\uD83D\uDC65"
          testId="metric-contributors"
        />
        <MetricCard
          label="Total Bounties"
          value={data.totalBounties}
          change={data.openBounties > 0 ? `${data.openBounties} open` : undefined}
          changePositive={true}
          icon="\uD83C\uDFAF"
          testId="metric-bounties"
        />
        <MetricCard
          label="FNDRY Paid"
          value={data.totalFndryPaid.toLocaleString()}
          icon="\uD83D\uDCB0"
          testId="metric-fndry-paid"
        />
        <MetricCard
          label="PRs Reviewed"
          value={data.totalPrsReviewed}
          change={data.averageReviewScore > 0 ? `Avg: ${data.averageReviewScore.toFixed(1)}` : undefined}
          changePositive={true}
          icon="\uD83D\uDD0D"
          testId="metric-prs-reviewed"
        />
      </div>

      {/* Growth trend chart */}
      <section className="rounded-xl border border-gray-700 bg-[#111111] p-5">
        <h2 className="text-lg font-semibold text-white mb-4">Growth Trend</h2>
        <GrowthTrendChart data={data.growthTrend} height={320} />
      </section>

      {/* Status breakdown and top categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bounties by status */}
        <section className="rounded-xl border border-gray-700 bg-[#111111] p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Bounties by Status</h2>
          {Object.keys(data.bountiesByStatus).length === 0 ? (
            <p className="text-sm text-gray-500">No bounty data available</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(data.bountiesByStatus)
                .sort(([, countA], [, countB]) => countB - countA)
                .map(([status, count]) => {
                  const config = STATUS_CONFIG[status] || { label: status, color: 'bg-gray-500/20 text-gray-400' };
                  const percentage = data.totalBounties > 0
                    ? ((count / data.totalBounties) * 100).toFixed(1)
                    : '0';
                  return (
                    <div key={status} className="flex items-center gap-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium min-w-[90px] text-center ${config.color}`}>
                        {config.label}
                      </span>
                      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#9945FF] rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 min-w-[60px] text-right">
                        {count} ({percentage}%)
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </section>

        {/* Top categories */}
        <section className="rounded-xl border border-gray-700 bg-[#111111] p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Top Categories</h2>
          {data.topCategories.length === 0 ? (
            <p className="text-sm text-gray-500">No category data available</p>
          ) : (
            <div className="space-y-3">
              {data.topCategories.map((cat) => (
                <div key={cat.category} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium capitalize truncate">
                      {cat.category}
                    </p>
                    <p className="text-xs text-gray-500">
                      {cat.totalBounties} bounties, {cat.completionRate.toFixed(0)}% completion
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-sm text-[#14F195] font-semibold">
                      {cat.totalRewardPaid.toLocaleString()} FNDRY
                    </p>
                    {cat.averageReviewScore > 0 && (
                      <p className="text-xs text-gray-400">
                        Avg score: {cat.averageReviewScore.toFixed(1)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Additional stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricCard
          label="Completed Bounties"
          value={data.completedBounties}
          icon="\u2705"
          testId="metric-completed-bounties"
        />
        <MetricCard
          label="In Progress"
          value={data.inProgressBounties}
          icon="\u23F3"
          testId="metric-in-progress"
        />
        <MetricCard
          label="Active Contributors"
          value={data.activeContributors}
          icon="\uD83D\uDFE2"
          testId="metric-active-contributors"
        />
      </div>
    </div>
  );
}

export default PlatformHealthPage;
