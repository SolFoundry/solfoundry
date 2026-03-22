/**
 * PipelineRunList -- Displays a list of CI/CD pipeline runs with stage details.
 *
 * Each run shows its branch, commit SHA, status badge, duration, and
 * expandable stage progress. Used on the Pipeline Dashboard page.
 *
 * @module components/pipelines/PipelineRunList
 */
import { useState } from 'react';
import type { PipelineRun } from '../../pages/PipelineDashboardPage';

/** Props for the PipelineRunList component. */
interface PipelineRunListProps {
  /** Array of pipeline run objects from the API. */
  runs: PipelineRun[];
  /** Whether the data is currently loading. */
  isLoading: boolean;
  /** Total count of runs matching the current filter. */
  total: number;
}

/** Map pipeline status to display color class. */
const STATUS_COLORS: Record<string, string> = {
  queued: 'bg-yellow-500/20 text-yellow-400',
  running: 'bg-blue-500/20 text-blue-400',
  success: 'bg-[#14F195]/20 text-[#14F195]',
  failure: 'bg-red-500/20 text-red-400',
  cancelled: 'bg-gray-500/20 text-gray-400',
};

/** Map stage status to display color class. */
const STAGE_COLORS: Record<string, string> = {
  pending: 'bg-gray-600',
  running: 'bg-blue-500 animate-pulse',
  passed: 'bg-[#14F195]',
  failed: 'bg-red-500',
  skipped: 'bg-gray-500',
};

/**
 * Format seconds into a human-readable duration string.
 *
 * @param seconds - Duration in seconds (may be null).
 * @returns Formatted string like "2m 15s" or "--" if null.
 */
function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '--';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Format an ISO date string into a relative time display.
 *
 * @param isoString - ISO 8601 date string.
 * @returns Relative time string like "2 hours ago".
 */
function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return '--';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

/**
 * Pipeline run list component.
 *
 * Renders each pipeline run as an expandable card showing branch info,
 * commit SHA, status badge, duration, and stage progress indicators.
 */
export function PipelineRunList({ runs, isLoading, total }: PipelineRunListProps) {
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((index) => (
          <div
            key={index}
            className="h-20 bg-white/5 rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">No pipeline runs found.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">{total} total runs</p>
      <div className="space-y-3">
        {runs.map((run) => {
          const isExpanded = expandedRunId === run.id;
          return (
            <div
              key={run.id}
              className="bg-white/5 rounded-lg border border-white/10 overflow-hidden"
            >
              {/* Run Header */}
              <button
                onClick={() => setExpandedRunId(isExpanded ? null : run.id)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors text-left"
                aria-expanded={isExpanded}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Status Badge */}
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      STATUS_COLORS[run.status] ?? 'bg-gray-500/20 text-gray-400'
                    }`}
                  >
                    {run.status}
                  </span>

                  {/* Branch & Commit */}
                  <div className="min-w-0">
                    <span className="text-sm text-white font-mono truncate block">
                      {run.branch}
                    </span>
                    <span className="text-xs text-gray-500 font-mono">
                      {run.commit_sha.slice(0, 7)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Stage Progress */}
                  <div className="hidden sm:flex gap-1">
                    {run.stages.map((stage) => (
                      <div
                        key={stage.id}
                        className={`w-2 h-2 rounded-full ${
                          STAGE_COLORS[stage.status] ?? 'bg-gray-600'
                        }`}
                        title={`${stage.name}: ${stage.status}`}
                      />
                    ))}
                  </div>

                  {/* Duration */}
                  <span className="text-xs text-gray-400 font-mono w-16 text-right">
                    {formatDuration(run.duration_seconds)}
                  </span>

                  {/* Time */}
                  <span className="text-xs text-gray-500 w-16 text-right">
                    {formatRelativeTime(run.created_at)}
                  </span>

                  {/* Expand Icon */}
                  <svg
                    className={`w-4 h-4 text-gray-500 transition-transform ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </button>

              {/* Expanded Stage Details */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-white/5">
                  <div className="mt-3 space-y-2">
                    {run.stages.map((stage) => (
                      <div
                        key={stage.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2.5 h-2.5 rounded-full ${
                              STAGE_COLORS[stage.status] ?? 'bg-gray-600'
                            }`}
                          />
                          <span className="text-gray-300 font-mono">
                            {stage.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              STATUS_COLORS[stage.status] ??
                              'bg-gray-500/20 text-gray-400'
                            }`}
                          >
                            {stage.status}
                          </span>
                          <span className="text-xs text-gray-500 font-mono w-14 text-right">
                            {formatDuration(stage.duration_seconds)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {run.error_message && (
                    <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400 font-mono">
                      {run.error_message}
                    </div>
                  )}

                  <div className="mt-3 flex gap-4 text-xs text-gray-500">
                    <span>Trigger: {run.trigger}</span>
                    <span>Repository: {run.repository}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
