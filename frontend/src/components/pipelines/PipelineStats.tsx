/**
 * PipelineStats -- Aggregate CI/CD pipeline statistics display.
 *
 * Renders a row of stat cards showing total runs, success rate,
 * average duration, and status breakdown. Updates every 30 seconds
 * via React Query refetch.
 *
 * @module components/pipelines/PipelineStats
 */
import type { PipelineStatistics } from '../../pages/PipelineDashboardPage';

/** Props for the PipelineStats component. */
interface PipelineStatsProps {
  /** Pipeline statistics from the API (null while loading). */
  stats: PipelineStatistics | null;
  /** Whether the statistics are currently loading. */
  isLoading: boolean;
}

/**
 * Format a success rate (0.0-1.0) as a percentage string.
 *
 * @param rate - Success rate as a decimal.
 * @returns Formatted percentage string like "85.2%".
 */
function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

/**
 * Format average duration in seconds to a readable string.
 *
 * @param seconds - Average duration or null.
 * @returns Formatted string like "3m 42s" or "--".
 */
function formatAvgDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '--';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.round(seconds % 60);
  return `${minutes}m ${remaining}s`;
}

/**
 * Pipeline statistics card grid component.
 *
 * Displays four stat cards in a responsive grid: total runs,
 * success rate, average duration, and a status breakdown bar.
 */
export function PipelineStats({ stats, isLoading }: PipelineStatsProps) {
  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((index) => (
          <div
            key={index}
            className="h-24 bg-white/5 rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  const successCount = stats.status_counts?.success ?? 0;
  const failureCount = stats.status_counts?.failure ?? 0;
  const runningCount = stats.status_counts?.running ?? 0;
  const queuedCount = stats.status_counts?.queued ?? 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Total Runs */}
      <div className="bg-white/5 rounded-lg border border-white/10 p-4">
        <p className="text-xs text-gray-500 uppercase tracking-wider">Total Runs</p>
        <p className="mt-1 text-2xl font-bold text-white font-mono">
          {stats.total_runs}
        </p>
      </div>

      {/* Success Rate */}
      <div className="bg-white/5 rounded-lg border border-white/10 p-4">
        <p className="text-xs text-gray-500 uppercase tracking-wider">Success Rate</p>
        <p
          className={`mt-1 text-2xl font-bold font-mono ${
            stats.success_rate >= 0.8
              ? 'text-[#14F195]'
              : stats.success_rate >= 0.5
                ? 'text-yellow-400'
                : 'text-red-400'
          }`}
        >
          {formatPercent(stats.success_rate)}
        </p>
      </div>

      {/* Average Duration */}
      <div className="bg-white/5 rounded-lg border border-white/10 p-4">
        <p className="text-xs text-gray-500 uppercase tracking-wider">Avg Duration</p>
        <p className="mt-1 text-2xl font-bold text-white font-mono">
          {formatAvgDuration(stats.average_duration_seconds)}
        </p>
      </div>

      {/* Status Breakdown */}
      <div className="bg-white/5 rounded-lg border border-white/10 p-4">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Status</p>
        <div className="flex gap-3 text-xs">
          <span className="text-[#14F195]">{successCount} passed</span>
          <span className="text-red-400">{failureCount} failed</span>
          <span className="text-blue-400">{runningCount} active</span>
          {queuedCount > 0 && (
            <span className="text-yellow-400">{queuedCount} queued</span>
          )}
        </div>

        {/* Progress bar */}
        {stats.total_runs > 0 && (
          <div className="mt-2 h-1.5 bg-white/5 rounded-full overflow-hidden flex">
            {successCount > 0 && (
              <div
                className="bg-[#14F195] h-full"
                style={{ width: `${(successCount / stats.total_runs) * 100}%` }}
              />
            )}
            {failureCount > 0 && (
              <div
                className="bg-red-500 h-full"
                style={{ width: `${(failureCount / stats.total_runs) * 100}%` }}
              />
            )}
            {runningCount > 0 && (
              <div
                className="bg-blue-500 h-full"
                style={{ width: `${(runningCount / stats.total_runs) * 100}%` }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
