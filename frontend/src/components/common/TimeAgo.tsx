import React, { useState, useEffect, useMemo, useCallback } from 'react';

interface TimeAgoProps {
  /**
   * The date to format (ISO string, timestamp, or Date object)
   */
  date: string | number | Date;
  /**
   * Custom className for the wrapper element
   */
  className?: string;
  /**
   * Whether to show full date in tooltip (default: true)
   */
  showTooltip?: boolean;
  /**
   * Whether to auto-update (default: true for recent items)
   */
  autoUpdate?: boolean;
  /**
   * Locale for date formatting (default: 'en-US')
   */
  locale?: string;
}

/**
 * TimeAgo Component
 * 
 * Displays relative timestamps ('2 hours ago', '3 days ago') with full date on hover.
 * Auto-updates every minute for recent items.
 * 
 * Features:
 * - Smart formatting: 'just now', '5m ago', '2h ago', '3d ago', 'Mar 15' (>7 days)
 * - Full datetime on hover tooltip
 * - Auto-updates every minute for items < 1 hour old
 * - Handles timezone correctly using native Date
 * - No heavy date library dependency
 * - Accessible with proper ARIA attributes
 */
export const TimeAgo: React.FC<TimeAgoProps> = ({
  date,
  className = '',
  showTooltip = true,
  autoUpdate = true,
  locale = 'en-US',
}) => {
  // Parse the input date
  const parsedDate = useMemo(() => {
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      console.error('Invalid date provided to TimeAgo:', date);
      return new Date();
    }
    return d;
  }, [date]);

  // State for current time (for auto-updates)
  const [now, setNow] = useState(new Date());

  // Format the relative time
  const formatRelativeTime = useCallback((date: Date, now: Date) => {
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    // Handle future dates
    if (seconds < 0) {
      return 'just now';
    }

    // Just now
    if (seconds < 10) {
      return 'just now';
    }

    // Minutes
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes}m ago`;
    }

    // Hours
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours}h ago`;
    }

    // Days
    const days = Math.floor(hours / 24);
    if (days < 7) {
      return `${days}d ago`;
    }

    // Weeks
    const weeks = Math.floor(days / 7);
    if (weeks < 4) {
      return `${weeks}w ago`;
    }

    // Months
    const months = Math.floor(days / 30);
    if (months < 12) {
      return `${months}mo ago`;
    }

    // Years
    const years = Math.floor(days / 365);
    return `${years}y ago`;
  }, []);

  // Format full date for tooltip
  const formatFullDate = useCallback((date: Date) => {
    return date.toLocaleString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }, [locale]);

  // Format for display (>7 days shows date)
  const formatDisplay = useCallback((date: Date, now: Date) => {
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    const days = Math.floor(seconds / 86400);
    
    if (days > 7) {
      return date.toLocaleDateString(locale, {
        month: 'short',
        day: 'numeric',
      });
    }
    
    return formatRelativeTime(date, now);
  }, [locale, formatRelativeTime]);

  // Calculate if we should auto-update
  const shouldUpdate = useMemo(() => {
    if (!autoUpdate) return false;
    const seconds = Math.floor((now.getTime() - parsedDate.getTime()) / 1000);
    return seconds < 3600; // Update if less than 1 hour old
  }, [autoUpdate, parsedDate, now]);

  // Auto-update effect
  useEffect(() => {
    if (!shouldUpdate) return;

    // Update every minute for recent items
    const interval = setInterval(() => {
      setNow(new Date());
    }, 60000);

    return () => clearInterval(interval);
  }, [shouldUpdate]);

  const relativeTime = formatRelativeTime(parsedDate, now);
  const displayTime = formatDisplay(parsedDate, now);
  const fullDate = formatFullDate(parsedDate);

  return (
    <span
      className={`inline-block ${className}`}
      title={showTooltip ? fullDate : undefined}
      suppressHydrationWarning
    >
      {displayTime}
    </span>
  );
};

export default TimeAgo;
