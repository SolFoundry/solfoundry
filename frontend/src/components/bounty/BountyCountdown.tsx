import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, Zap } from 'lucide-react';
import { getTimeParts } from '../../lib/utils';

/**
 * Urgency level for the countdown display.
 * Determines color scheme and warning icon shown to the user.
 */
export type CountdownUrgency = 'normal' | 'warning' | 'urgent' | 'expired';

/**
 * Determines the urgency level based on time remaining.
 *
 * @param expired  - Whether the deadline has already passed.
 * @param days     - Whole days remaining.
 * @param hours    - Whole hours remaining in the current day.
 * @returns The corresponding urgency tier.
 */
function getUrgency(expired: boolean, days: number, hours: number): CountdownUrgency {
  if (expired) return 'expired';
  if (days === 0 && hours < 1) return 'urgent';
  if (days === 0) return 'warning';
  return 'normal';
}

const urgencyStyles: Record<CountdownUrgency, { text: string; bg: string; border: string; icon: React.ReactNode }> = {
  normal: {
    text: 'text-text-muted',
    bg: 'bg-forge-800',
    border: 'border-border',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  warning: {
    text: 'text-status-warning',
    bg: 'bg-status-warning/10',
    border: 'border-status-warning/30',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
  urgent: {
    text: 'text-status-error',
    bg: 'bg-status-error/10',
    border: 'border-status-error/30',
    icon: <Zap className="w-3.5 h-3.5" />,
  },
  expired: {
    text: 'text-text-muted',
    bg: 'bg-forge-800',
    border: 'border-border',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
};

interface BountyCountdownProps {
  deadline: string;
  /** Compact: single-line layout for cards. Default: false (detailed). */
  compact?: boolean;
  /** Badge variant: icon-only or icon+text inline style. Default: undefined. */
  variant?: 'badge';
  /** Show seconds tick. Default: false. */
  showSeconds?: boolean;
  /** Additional CSS classes. */
  className?: string;
}

/**
 * Live countdown timer for bounty deadlines.
 *
 * Displays the time remaining until a deadline in a visually distinct card or inline badge.
 * Urgency escalates automatically — normal → warning → urgent → expired — as the deadline
 * approaches, using colour and icon changes to draw the user's attention.
 *
 * @param deadline    - ISO-8601 date string (e.g. "2025-12-31T23:59:59Z").
 * @param compact     - Single-line badge layout suitable for cards. Default false (detailed).
 * @param variant     - Render as "badge" (icon + text, inline). Default undefined.
 * @param showSeconds - Whether to tick through seconds. Default false.
 * @param className  - Additional CSS classes to apply to the root element.
 */
export function BountyCountdown({ deadline, compact = false, variant, showSeconds = false, className = '' }: BountyCountdownProps) {
  const [parts, setParts] = useState(() => getTimeParts(deadline));

  useEffect(() => {
    const interval = setInterval(() => {
      setParts(getTimeParts(deadline));
    }, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  const urgency = getUrgency(parts.expired, parts.days, parts.hours);
  const style = urgencyStyles[urgency];

  // Variant-specific branch is handled before the expired early return,
  // so badge variant gets proper styling even when expired.
  if (compact || variant === 'badge') {
    const icon = style.icon;
    return (
      <span className={`inline-flex items-center gap-1 font-mono text-xs ${style.text}`}>
        {icon}
        {parts.expired ? 'Expired' : `${parts.days}d ${parts.hours}h ${parts.minutes}m`}
      </span>
    );
  }

  const icon = style.icon;
  const textStyle = style.text;

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${style.bg} ${style.border} ${className}`}
    >
      <span className={textStyle}>{icon}</span>
      {parts.expired ? (
        <span className={`font-mono text-sm font-medium ${textStyle}`}>Expired</span>
      ) : (
        <span className={`font-mono text-sm font-medium ${textStyle}`}>
          {parts.days > 0 && <span>{parts.days}<span className="text-xs ml-0.5 mr-1">d</span></span>}
          {parts.days > 0 && parts.hours > 0 && <span>{parts.hours}<span className="text-xs ml-0.5 mr-1">h</span></span>}
          {parts.days === 0 && <span>{parts.hours}<span className="text-xs ml-0.5 mr-1">h</span></span>}
          <span>{parts.minutes}<span className="text-xs ml-0.5 mr-1">m</span></span>
          {showSeconds && <span>{parts.seconds}<span className="text-xs ml-0.5">s</span></span>}
        </span>
      )}
    </div>
  );
}