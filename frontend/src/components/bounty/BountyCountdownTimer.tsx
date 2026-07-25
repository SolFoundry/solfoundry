/**
 * BountyCountdownTimer — Real-time countdown with urgency indicators.
 *
 * Shows days/hours/minutes/seconds remaining until a deadline.
 * Color coding:
 *   - Normal: emerald (default)
 *   - < 24h: warning yellow
 *   - < 1h: urgent red
 *   - Expired: muted text
 */
import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { getCountdownValues } from '../../lib/utils';

interface BountyCountdownTimerProps {
  deadline: string | number | Date;
  /** If true, show as a compact inline display (for cards). Default: false */
  compact?: boolean;
}

export function BountyCountdownTimer({ deadline, compact = false }: BountyCountdownTimerProps) {
  const [values, setValues] = useState(() => getCountdownValues(deadline));

  useEffect(() => {
    setValues(getCountdownValues(deadline));
    const interval = setInterval(() => {
      setValues(getCountdownValues(deadline));
    }, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  const { days, hours, minutes, seconds, isExpired, isUrgent, isWarning } = values;

  if (isExpired) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-text-muted">
        <Clock className="w-3.5 h-3.5" />
        Expired
      </span>
    );
  }

  const colorClass = isUrgent
    ? 'text-status-error'
    : isWarning
      ? 'text-status-warning'
      : 'text-emerald';

  if (compact) {
    // Compact card display: "3d 12h left" or "5h 30m left" or "Expired"
    let label: string;
    if (days > 0) {
      label = `${days}d ${hours}h left`;
    } else if (hours > 0) {
      label = `${hours}h ${minutes}m left`;
    } else {
      label = `${minutes}m ${seconds}s left`;
    }

    return (
      <span className={`inline-flex items-center gap-1 text-xs font-mono ${colorClass}`}>
        <Clock className="w-3.5 h-3.5" />
        {label}
      </span>
    );
  }

  // Full detail display: "3d 12h 30m 15s" with segments
  const pad = (n: number) => n.toString().padStart(2, '0');

  return (
    <div className={`inline-flex items-center gap-2 font-mono ${colorClass}`}>
      <Clock className="w-4 h-4" />
      <div className="flex items-center gap-1">
        {days > 0 && (
          <>
            <span className="text-lg font-bold">{days}</span>
            <span className="text-xs opacity-70">d</span>
          </>
        )}
        <span className="text-lg font-bold">{pad(hours)}</span>
        <span className="text-xs opacity-70">h</span>
        <span className="text-lg font-bold">{pad(minutes)}</span>
        <span className="text-xs opacity-70">m</span>
        <span className="text-lg font-bold">{pad(seconds)}</span>
        <span className="text-xs opacity-70">s</span>
      </div>
    </div>
  );
}