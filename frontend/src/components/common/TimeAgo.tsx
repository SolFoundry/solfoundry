/**
 * TimeAgo — Reusable component for displaying relative timestamps.
 *
 * Shows relative time like 'just now', '5m ago', '2h ago', '3d ago'
 * with full datetime on hover. Auto-updates every minute for recent items.
 *
 * @module components/common/TimeAgo
 */
import { useState, useEffect, useMemo } from 'react';

export interface TimeAgoProps {
  /** Date string or timestamp to display */
  date: string | Date | number;
  /** Optional CSS class for styling */
  className?: string;
  /** Update interval in ms (default: 60000 for 1 minute) */
  updateInterval?: number;
}

/**
 * Validates if a date input is valid.
 * Returns true if the date is valid, false otherwise.
 */
function isValidDate(date: string | Date | number): boolean {
  // Check for NaN input first
  if (typeof date === 'number' && isNaN(date)) {
    return false;
  }
  const d = new Date(date);
  return !isNaN(d.getTime());
}

/**
 * Formats a date into a relative time string.
 * Returns formats like: 'just now', '5m ago', '2h ago', '3d ago', 'Mar 15'
 */
export function formatTimeAgo(date: string | Date | number): string {
  // Handle invalid dates
  if (!isValidDate(date)) {
    return 'Invalid date';
  }

  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;

  // Future dates
  if (diffMs < 0) {
    const absDiff = Math.abs(diffMs);
    const minutes = Math.floor(absDiff / 60000);
    const hours = Math.floor(absDiff / 3600000);
    const days = Math.floor(absDiff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `in ${minutes}m`;
    if (hours < 24) return `in ${hours}h`;
    if (days < 7) return `in ${days}d`;
    return new Date(then).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // Past dates
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (seconds < 10) return 'just now';
  if (minutes < 1) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days <= 7) return `${days}d ago`;

  // More than 7 days: show date (use UTC for deterministic output)
  return new Date(then).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/**
 * Formats a date into a full datetime string for tooltip display.
 */
export function formatFullDate(date: string | Date | number): string {
  if (!isValidDate(date)) {
    return 'Invalid date';
  }
  const d = new Date(date);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  });
}

/**
 * TimeAgo component — displays relative time with tooltip.
 *
 * @example
 * <TimeAgo date={bounty.createdAt} />
 * <TimeAgo date={activity.timestamp} className="text-gray-500" />
 */
export function TimeAgo({
  date,
  className = '',
  updateInterval = 60000, // 1 minute default
}: TimeAgoProps) {
  const isValid = isValidDate(date);
  
  // Use safe date for display (fallback to current time if invalid)
  const safeDate = isValid ? date : new Date().toISOString();
  
  // Use original date for formatting (to show "Invalid date" when invalid)
  const [timeAgo, setTimeAgo] = useState(() => formatTimeAgo(date));
  const fullDate = useMemo(() => formatFullDate(safeDate), [safeDate]);

  useEffect(() => {
    // Update immediately when date changes
    setTimeAgo(formatTimeAgo(date));

    // Skip interval for invalid dates
    if (!isValid) {
      return;
    }

    // Set up interval for auto-updates (only for recent items)
    const then = new Date(safeDate).getTime();
    const diffDays = (Date.now() - then) / 86400000;

    // Only auto-update if 7 days or less old
    if (diffDays <= 7) {
      const interval = setInterval(() => {
        setTimeAgo(formatTimeAgo(date));
      }, updateInterval);

      return () => clearInterval(interval);
    }
  }, [date, updateInterval, isValid, safeDate]);

  return (
    <time
      dateTime={isValid ? new Date(safeDate).toISOString() : undefined}
      title={fullDate}
      className={`cursor-help ${className}`}
    >
      {timeAgo}
    </time>
  );
}

export default TimeAgo;
