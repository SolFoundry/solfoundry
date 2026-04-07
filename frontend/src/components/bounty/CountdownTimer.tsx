import React, { useEffect, useState, useMemo } from 'react';

export interface CountdownTimerProps {
  /** ISO 8601 deadline string or Date object */
  deadline: string | Date;
  /** Optional CSS class name */
  className?: string;
  /** Whether to show seconds (default: only show when <1 day left) */
  showSeconds?: boolean;
  /** Custom urgency thresholds in milliseconds */
  urgencyThresholds?: {
    urgent?: number; // Default: 1 hour (3600000 ms)
    warning?: number; // Default: 24 hours (86400000 ms)
  };
  /** Custom aria label prefix */
  ariaLabelPrefix?: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

function calculateTimeLeft(deadline: Date): TimeLeft {
  const total = deadline.getTime() - Date.now();
  if (total <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
  }
  return {
    days: Math.floor(total / (1000 * 60 * 60 * 24)),
    hours: Math.floor((total / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((total / (1000 * 60)) % 60),
    seconds: Math.floor((total / 1000) % 60),
    total,
  };
}

function padTwo(n: number): string {
  return n.toString().padStart(2, '0');
}

export type Urgency = 'normal' | 'warning' | 'urgent' | 'expired';

function getUrgency(totalMs: number, thresholds: Required<CountdownTimerProps['urgencyThresholds']>): Urgency {
  if (totalMs <= 0) return 'expired';
  if (totalMs < thresholds.urgent) return 'urgent';
  if (totalMs < thresholds.warning) return 'warning';
  return 'normal';
}

const urgencyStyles: Record<Urgency, string> = {
  normal: 'text-emerald-400 bg-emerald-950/50 border-emerald-800',
  warning: 'text-amber-400 bg-amber-950/50 border-amber-800 animate-pulse',
  urgent: 'text-red-400 bg-red-950/50 border-red-800 animate-pulse',
  expired: 'text-gray-500 bg-gray-900/50 border-gray-700',
};

export function CountdownTimer({
  deadline,
  className = '',
  showSeconds,
  urgencyThresholds = {},
  ariaLabelPrefix = 'Time remaining',
}: CountdownTimerProps) {
  const deadlineDate = useMemo(
    () => (deadline instanceof Date ? deadline : new Date(deadline)),
    [deadline],
  );

  const resolvedThresholds = useMemo(() => ({
    urgent: urgencyThresholds.urgent ?? 3600000, // 1 hour
    warning: urgencyThresholds.warning ?? 86400000, // 24 hours
  }), [urgencyThresholds]);

  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => calculateTimeLeft(deadlineDate));

  useEffect(() => {
    if (timeLeft.total <= 0) return;

    const interval = setInterval(() => {
      const updated = calculateTimeLeft(deadlineDate);
      setTimeLeft(updated);
      if (updated.total <= 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [deadlineDate, timeLeft.total]);

  const urgency = getUrgency(timeLeft.total, resolvedThresholds);

  if (urgency === 'expired') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-mono border ${urgencyStyles.expired} ${className}`}
        aria-label="Bounty deadline expired"
      >
        ⏰ Expired
      </span>
    );
  }

  const parts: string[] = [];
  if (timeLeft.days > 0) parts.push(`${timeLeft.days}d`);
  parts.push(`${padTwo(timeLeft.hours)}h`);
  parts.push(`${padTwo(timeLeft.minutes)}m`);
  
  const shouldShowSeconds = showSeconds ?? (timeLeft.days === 0);
  if (shouldShowSeconds) parts.push(`${padTwo(timeLeft.seconds)}s`);

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-mono border ${urgencyStyles[urgency]} ${className}`}
      aria-label={`${ariaLabelPrefix}: ${parts.join(' ')}`}
      aria-live="polite"
    >
      ⏰ {parts.join(' ')}
    </span>
  );
}
