/**
 * CountdownTimer — Displays a real-time countdown to a bounty deadline.
 *
 * Shows days, hours, minutes (and optionally seconds) remaining.
 * Automatically changes color based on urgency:
 *   - Normal (>24h): text-text-muted (default)
 *   - Warning (<24h): text-status-warning (amber)
 *   - Urgent (<1h): text-status-error (red)
 *   - Expired: shows "Expired" text
 *
 * Usage:
 *   <CountdownTimer deadline="2026-05-01T00:00:00Z" />
 *   <CountdownTimer deadline={bounty.deadline} showSeconds compact />
 */

import React from 'react';
import { Clock } from 'lucide-react';
import { useCountdown, UrgencyLevel } from '../hooks/useCountdown';

/** Color mapping for urgency levels using the project's Tailwind config */
const URGENCY_STYLES: Record<UrgencyLevel, { text: string; bg?: string }> = {
  normal: { text: 'text-text-muted' },
  warning: { text: 'text-status-warning' },
  urgent: { text: 'text-status-error' },
  expired: { text: 'text-text-muted' },
};

export interface CountdownTimerProps {
  /** ISO 8601 deadline string */
  deadline: string | null | undefined;
  /** Whether to show seconds (default: false) */
  showSeconds?: boolean;
  /** Compact mode — shows only "Xd Xh" without labels (default: false) */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show the clock icon (default: true) */
  showIcon?: boolean;
}

/**
 * Formats a number with leading zero.
 */
function pad(num: number): string {
  return num.toString().padStart(2, '0');
}

/**
 * CountdownTimer component.
 */
export function CountdownTimer({
  deadline,
  showSeconds = false,
  compact = false,
  className = '',
  showIcon = true,
}: CountdownTimerProps) {
  const { days, hours, minutes, seconds, urgency, isExpired } =
    useCountdown(deadline);

  const styles = URGENCY_STYLES[urgency];

  if (isExpired) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-xs font-medium ${styles.text} ${className}`}
        data-testid="countdown-expired"
      >
        {showIcon && <Clock className="w-3.5 h-3.5" />}
        Expired
      </span>
    );
  }

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-xs font-mono font-medium ${styles.text} ${className}`}
        data-testid="countdown-timer"
      >
        {showIcon && <Clock className="w-3.5 h-3.5" />}
        {days > 0 && <span>{days}d</span>}
        <span>{hours}h</span>
        {showSeconds && <span>{minutes}m</span>}
        {!showSeconds && <span>{minutes}m</span>}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${styles.text} ${className}`}
      data-testid="countdown-timer"
      aria-label={`${days} days, ${hours} hours, ${minutes} minutes remaining`}
    >
      {showIcon && <Clock className="w-3.5 h-3.5" />}
      <span className="font-mono">
        {days > 0 && (
          <>
            {pad(days)}d
            <span className="text-text-muted/60 mx-0.5">:</span>
          </>
        )}
        {pad(hours)}h
        <span className="text-text-muted/60 mx-0.5">:</span>
        {pad(minutes)}m
        {showSeconds && (
          <>
            <span className="text-text-muted/60 mx-0.5">:</span>
            {pad(seconds)}s
          </>
        )}
      </span>
    </span>
  );
}

export default CountdownTimer;
