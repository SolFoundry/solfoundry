/**
 * CodebaseSummaryBar — Aggregate statistics bar for the codebase map.
 *
 * Displays key metrics about the repository: total files, modules,
 * active bounties, recent commits, and recent PRs. Provides at-a-glance
 * context for the visualization.
 *
 * @module components/codebase-map/CodebaseSummaryBar
 */

import type { CodebaseSummary } from '../../types/codebase-map';

/** Props for the CodebaseSummaryBar component. */
export interface CodebaseSummaryBarProps {
  /** Aggregate statistics from the API response. */
  summary: CodebaseSummary;
  /** ISO timestamp of when the data was generated. */
  generatedAt: string;
}

/**
 * Horizontal statistics bar showing repository metrics.
 *
 * Rendered above the main visualization canvas to give users context
 * about the codebase they're exploring.
 */
export function CodebaseSummaryBar({
  summary,
  generatedAt,
}: CodebaseSummaryBarProps): JSX.Element {
  const generatedDate = new Date(generatedAt);
  const timeAgo = getRelativeTime(generatedDate);

  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 bg-surface-50
                 border border-white/10 rounded-lg text-xs"
      data-testid="codebase-summary-bar"
      role="status"
      aria-label="Codebase statistics"
    >
      <StatItem
        icon={
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        }
        value={summary.total_files.toLocaleString()}
        label="files"
      />
      <StatItem
        icon={
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
        }
        value={String(summary.total_modules)}
        label="modules"
      />
      <StatItem
        icon={
          <svg className="w-3 h-3 text-[#14F195]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
        value={String(summary.active_bounties)}
        label="active bounties"
      />
      <StatItem
        icon={
          <svg className="w-3 h-3 text-[#9945FF]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
          </svg>
        }
        value={String(summary.recent_prs)}
        label="recent PRs"
      />

      {/* Spacer */}
      <div className="flex-grow" />

      {/* Last updated */}
      <span className="text-gray-600" title={generatedDate.toISOString()}>
        Updated {timeAgo}
      </span>
    </div>
  );
}

/**
 * A single statistic item with icon, value, and label.
 *
 * @param props - The icon element, numeric value, and descriptive label.
 */
function StatItem({
  icon,
  value,
  label,
}: {
  icon: JSX.Element;
  value: string;
  label: string;
}): JSX.Element {
  return (
    <div className="flex items-center gap-1.5 text-gray-400">
      {icon}
      <span className="font-medium text-gray-200">{value}</span>
      <span>{label}</span>
    </div>
  );
}

/**
 * Convert a date to a human-readable relative time string.
 *
 * @param date - The date to convert.
 * @returns Relative time string (e.g., '2 minutes ago', 'just now').
 */
function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

export default CodebaseSummaryBar;
