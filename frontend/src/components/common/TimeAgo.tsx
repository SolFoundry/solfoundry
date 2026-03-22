/**
 * TimeAgo — Reusable relative timestamp component.
 * Displays human-readable relative times ("just now", "5m ago", "2h ago",
 * "3d ago", "Mar 15") with full datetime on hover tooltip.
 * Auto-updates every minute for recent timestamps.
 * @module components/common/TimeAgo
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Tooltip } from './Tooltip';

// ============================================================================
// Types
// ============================================================================

export interface TimeAgoProps {
  /** ISO 8601 date string or Date object */
  date: string | Date;
  /** Additional CSS class names */
  className?: string;
  /** Whether to auto-update the display (default: true) */
  live?: boolean;
  /** Update interval in milliseconds (default: 60000 = 1 minute) */
  updateInterval?: number;
}

// ============================================================================
// Constants
// ============================================================================

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/** Default update interval: 1 minute */
const DEFAULT_UPDATE_INTERVAL = 60 * SECOND;

// ============================================================================
// Formatting
// ============================================================================

/**
 * Formats a timestamp into a relative time string.
 *
 * - < 30 seconds: "just now"
 * - < 60 minutes: "Xm ago"
 * - < 24 hours: "Xh ago"
 * - < 7 days: "Xd ago"
 * - >= 7 days: "Mar 15" (abbreviated month + day)
 *
 * Handles future dates by returning "just now" to avoid confusion.
 */
export function formatTimeAgo(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();

  // Future dates or very recent (< 30s)
  if (diffMs < 30 * SECOND) {
    return 'just now';
  }

  const diffMinutes = Math.floor(diffMs / MINUTE);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMs / HOUR);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffMs / DAY);
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  // > 7 days: show abbreviated month + day (e.g., "Mar 15")
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Formats a date into a full human-readable datetime string for the tooltip.
 * Example: "Saturday, March 22, 2026 at 3:45 PM"
 */
function formatFullDatetime(date: Date): string {
  return date.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Determines whether a timestamp is "recent" enough to benefit from
 * auto-updating (within the last hour).
 */
function isRecent(date: Date, now: Date = new Date()): boolean {
  return now.getTime() - date.getTime() < HOUR;
}

// ============================================================================
// Component
// ============================================================================

/**
 * TimeAgo displays a relative timestamp that auto-updates for recent items.
 * Shows full datetime in a hover tooltip.
 *
 * @example
 * ```tsx
 * <TimeAgo date="2026-03-22T15:00:00Z" />
 * // Renders: "5m ago" (with "Saturday, March 22, 2026 at 3:00 PM" on hover)
 *
 * <TimeAgo date={new Date()} live={true} />
 * // Renders: "just now" (updates every minute)
 * ```
 */
export function TimeAgo({
  date: dateProp,
  className = '',
  live = true,
  updateInterval = DEFAULT_UPDATE_INTERVAL,
}: TimeAgoProps) {
  const parsedDate = useMemo(
    () => (dateProp instanceof Date ? dateProp : new Date(dateProp)),
    [dateProp],
  );

  const [, setTick] = useState(0);

  const getRelativeTime = useCallback(
    () => formatTimeAgo(parsedDate),
    [parsedDate],
  );

  // Auto-update for recent timestamps
  useEffect(() => {
    if (!live || !isRecent(parsedDate)) return;

    const interval = setInterval(() => {
      setTick((t) => t + 1);

      // Stop updating once the timestamp is no longer "recent"
      if (!isRecent(parsedDate)) {
        clearInterval(interval);
      }
    }, updateInterval);

    return () => clearInterval(interval);
  }, [live, parsedDate, updateInterval]);

  const relativeTime = getRelativeTime();
  const fullDatetime = formatFullDatetime(parsedDate);

  return (
    <Tooltip content={fullDatetime} position="top" delay={200}>
      <time
        dateTime={parsedDate.toISOString()}
        className={`text-gray-400 whitespace-nowrap ${className}`}
        title={fullDatetime}
      >
        {relativeTime}
      </time>
    </Tooltip>
  );
}
