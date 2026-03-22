import { useState, useEffect } from 'react';

// =============================================================================
// TimeAgo — displays a human-readable relative time string
// that auto-refreshes every minute.
// =============================================================================

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TimeAgoProps {
  /** The point in time to display. Accepts a Date, ISO string, or Unix ms timestamp. */
  date: Date | string | number;
  /** Optional extra CSS classes applied to the <time> element. */
  className?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Coerce the flexible `date` prop to a Date object. */
function toDate(value: Date | string | number): Date {
  if (value instanceof Date) return value;
  return new Date(value);
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Format a Date relative to `now`:
 *  - <60 s      → "just now"
 *  - <60 min    → "5m ago"
 *  - <24 h      → "2h ago"
 *  - <7 days    → "3d ago"
 *  - ≥7 days    → "Mar 15"  (or "Mar 15, 2023" for a different year)
 */
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();

  // Future dates — treat as "just now" rather than negative output
  if (diffMs < 0) return 'just now';

  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return 'just now';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;

  // Absolute short date
  const month = MONTH_NAMES[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  const nowYear = now.getFullYear();

  return year === nowYear ? `${month} ${day}` : `${month} ${day}, ${year}`;
}

/**
 * Format a Date as a full, human-readable datetime string for use in
 * the tooltip, e.g. "Tuesday, March 15, 2025 at 3:04 PM".
 */
function formatFullDateTime(date: Date): string {
  return date.toLocaleString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * TimeAgo
 *
 * Renders a `<time>` element showing a relative time string (e.g. "5m ago",
 * "2h ago", "Mar 15"). Auto-updates every minute so the label stays current
 * without a page reload. Hovering reveals the full datetime via a `title`
 * tooltip.
 *
 * @example
 * <TimeAgo date={bounty.created_at} className="text-gray-500" />
 */
export function TimeAgo({ date, className = '' }: TimeAgoProps) {
  const parsed = toDate(date);

  const [relative, setRelative] = useState<string>(() =>
    formatRelativeTime(parsed),
  );

  useEffect(() => {
    // Recalculate immediately in case the initial render was slightly stale
    setRelative(formatRelativeTime(parsed));

    const interval = setInterval(() => {
      setRelative(formatRelativeTime(parsed));
    }, 60_000);

    return () => clearInterval(interval);
  }, [parsed.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  const isoString = parsed.toISOString();
  const fullLabel = formatFullDateTime(parsed);

  return (
    <time
      dateTime={isoString}
      title={fullLabel}
      className={className}
    >
      {relative}
    </time>
  );
}

export default TimeAgo;
