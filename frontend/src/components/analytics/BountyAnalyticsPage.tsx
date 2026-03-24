/**
 * BountyAnalyticsPage - Bounty completion statistics and analytics.
 *
 * Displays bounty analytics including:
 * - Overall completion rate and review score metrics
 * - Tier completion chart (Recharts bar chart)
 * - Category breakdown chart
 * - Detailed tier stats table
 * - Category stats table
 *
 * Uses React Query via useBountyAnalytics hook.
 * Responsive design with mobile-first approach.
 * @module components/analytics/BountyAnalyticsPage
 */

import { useState } from 'react';
import { useBountyAnalytics } from '../../hooks/useAnalytics';
import { SkeletonCard, SkeletonTable } from '../common/Skeleton';
import { MetricCard } from './MetricCard';
import { TierCompletionChart, CategoryBreakdownChart } from './AnalyticsCharts';
import type { AnalyticsTimeRange } from '../../types/analytics';

/** Time range options for bounty analytics. */
const TIME_RANGES: { label: string; value: AnalyticsTimeRange }[] = [
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
  { label: 'All time', value: 'all' },
];

/**
 * Bounty analytics page showing completion rates, scores, and breakdowns.
 *
 * Renders metric cards, interactive charts, and data tables for
 * bounty analytics grouped by tier and category.
 */
export function BountyAnalyticsPage() {
  const [timeRange, setTimeRange] = useState<AnalyticsTimeRange>('all');
  const { data, isLoading, isError, error } = useBountyAnalytics(timeRange);

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6" data-testid="bounty-analytics-page">
        <div className="h-8 w-48 bg-surface-200 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonCard key={i} bodyLines={2} />
          ))}
        </div>
        <SkeletonCard bodyLines={8} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 sm:p-6 max-w-6xl mx-auto" data-testid="bounty-analytics-page">
        <div className="text-center text-red-400 py-8" role="alert">
          Error: {error instanceof Error ? error.message : 'Failed to load bounty analytics'}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6" data-testid="bounty-analytics-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Bounty Analytics</h1>
        <p className="text-sm text-gray-400 mt-1">
          Completion rates, review scores, and time-to-completion by tier and category
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

      {/* Overall metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          label="Total Bounties"
          value={data.totalBounties}
          icon="\uD83D\uDCCB"
          testId="metric-total-bounties"
        />
        <MetricCard
          label="Completed"
          value={data.totalCompleted}
          icon="\u2705"
          testId="metric-completed"
        />
        <MetricCard
          label="Completion Rate"
          value={`${data.overallCompletionRate.toFixed(1)}%`}
          icon="\uD83D\uDCC8"
          testId="metric-completion-rate"
        />
        <MetricCard
          label="Avg Review Score"
          value={data.overallAverageReviewScore.toFixed(1)}
          icon="\u2B50"
          testId="metric-avg-score"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tier completion chart */}
        <section className="rounded-xl border border-gray-700 bg-[#111111] p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Completions by Tier</h2>
          <TierCompletionChart data={data.byTier} height={280} />
        </section>

        {/* Category breakdown chart */}
        <section className="rounded-xl border border-gray-700 bg-[#111111] p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Completions by Category</h2>
          {data.byCategory.length > 0 ? (
            <CategoryBreakdownChart data={data.byCategory} height={280} />
          ) : (
            <div className="flex items-center justify-center h-[280px] text-gray-500 text-sm">
              No category data available
            </div>
          )}
        </section>
      </div>

      {/* Tier stats table */}
      <section className="rounded-xl border border-gray-700 bg-[#111111] p-5">
        <h2 className="text-lg font-semibold text-white mb-4">Tier Statistics</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="table" aria-label="Tier statistics">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-left text-xs">
                <th className="py-2">Tier</th>
                <th className="py-2 text-right">Total</th>
                <th className="py-2 text-right">Completed</th>
                <th className="py-2 text-right">Rate</th>
                <th className="py-2 text-right hidden sm:table-cell">Avg Score</th>
                <th className="py-2 text-right hidden md:table-cell">Avg Time (hrs)</th>
                <th className="py-2 text-right">Paid (FNDRY)</th>
              </tr>
            </thead>
            <tbody>
              {data.byTier.map((tier) => (
                <tr key={tier.tier} className="border-b border-gray-800">
                  <td className="py-2.5 font-semibold text-white">Tier {tier.tier}</td>
                  <td className="py-2.5 text-right text-gray-300">{tier.totalBounties}</td>
                  <td className="py-2.5 text-right text-[#14F195]">{tier.completed}</td>
                  <td className="py-2.5 text-right text-gray-300">{tier.completionRate.toFixed(1)}%</td>
                  <td className="py-2.5 text-right text-gray-300 hidden sm:table-cell">
                    {tier.averageReviewScore.toFixed(1)}
                  </td>
                  <td className="py-2.5 text-right text-gray-300 hidden md:table-cell">
                    {tier.averageTimeToCompleteHours.toFixed(0)}
                  </td>
                  <td className="py-2.5 text-right text-[#14F195] font-semibold">
                    {tier.totalRewardPaid.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Category stats table */}
      {data.byCategory.length > 0 && (
        <section className="rounded-xl border border-gray-700 bg-[#111111] p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Category Statistics</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="table" aria-label="Category statistics">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400 text-left text-xs">
                  <th className="py-2">Category</th>
                  <th className="py-2 text-right">Total</th>
                  <th className="py-2 text-right">Completed</th>
                  <th className="py-2 text-right">Rate</th>
                  <th className="py-2 text-right hidden sm:table-cell">Avg Score</th>
                  <th className="py-2 text-right">Paid (FNDRY)</th>
                </tr>
              </thead>
              <tbody>
                {data.byCategory.map((cat) => (
                  <tr key={cat.category} className="border-b border-gray-800">
                    <td className="py-2.5 font-medium text-white capitalize">{cat.category}</td>
                    <td className="py-2.5 text-right text-gray-300">{cat.totalBounties}</td>
                    <td className="py-2.5 text-right text-[#14F195]">{cat.completed}</td>
                    <td className="py-2.5 text-right text-gray-300">{cat.completionRate.toFixed(1)}%</td>
                    <td className="py-2.5 text-right text-gray-300 hidden sm:table-cell">
                      {cat.averageReviewScore.toFixed(1)}
                    </td>
                    <td className="py-2.5 text-right text-[#14F195] font-semibold">
                      {cat.totalRewardPaid.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

export default BountyAnalyticsPage;
