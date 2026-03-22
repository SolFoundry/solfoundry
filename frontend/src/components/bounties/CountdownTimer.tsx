import React, { useState, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface CountdownTimerProps {
  /** ISO 8601 date string for the deadline */
  deadline: string;
  /** Compact mode for use in bounty cards */
  compact?: boolean;
  className?: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  expired: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

function computeTimeLeft(deadline: string): TimeLeft {
  const now = Date.now();
  const end = new Date(deadline).getTime();
  const diff = end - now;

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, expired: true };
  }

  const totalMinutes = Math.floor(diff / 1000 / 60);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  return { days, hours, minutes, expired: false };
}

function getUrgency(timeLeft: TimeLeft): 'normal' | 'warning' | 'critical' | 'expired' {
  if (timeLeft.expired) return 'expired';
  const totalHours = timeLeft.days * 24 + timeLeft.hours;
  if (totalHours < 6) return 'critical';
  if (totalHours < 24) return 'warning';
  return 'normal';
}

// ============================================================================
// CountdownTimer Component
// ============================================================================

const URGENCY_COLORS = {
  normal: 'text-solana-green',
  warning: 'text-amber-400',
  critical: 'text-red-400',
  expired: 'text-gray-500',
};

const URGENCY_BG = {
  normal: 'bg-solana-green/10',
  warning: 'bg-amber-400/10',
  critical: 'bg-red-400/10',
  expired: 'bg-white/5',
};

/**
 * CountdownTimer — Shows time remaining until a bounty deadline.
 *
 * Visual states:
 * - Green  when > 24h remaining
 * - Amber  when < 24h remaining
 * - Red    when < 6h remaining
 * - Grey "Expired" when deadline has passed
 *
 * Updates every minute. Cleans up the interval on unmount.
 */
export function CountdownTimer({ deadline, compact = false, className = '' }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => computeTimeLeft(deadline));

  useEffect(() => {
    // Update immediately when deadline prop changes
    setTimeLeft(computeTimeLeft(deadline));

    const id = setInterval(() => {
      setTimeLeft(computeTimeLeft(deadline));
    }, 60_000);

    return () => clearInterval(id);
  }, [deadline]);

  const urgency = getUrgency(timeLeft);
  const colorClass = URGENCY_COLORS[urgency];
  const bgClass = URGENCY_BG[urgency];

  if (timeLeft.expired) {
    return (
      <span
        className={`inline-flex items-center gap-1 font-mono text-gray-500 ${compact ? 'text-xs' : 'text-sm'} ${className}`}
        aria-label="Bounty deadline has expired"
        role="timer"
      >
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
        </svg>
        Expired
      </span>
    );
  }

  const label = timeLeft.days > 0
    ? `${timeLeft.days}d ${timeLeft.hours}h ${timeLeft.minutes}m`
    : `${timeLeft.hours}h ${timeLeft.minutes}m`;

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 font-mono text-xs px-2 py-0.5 rounded ${colorClass} ${bgClass} ${className}`}
        aria-label={`Time remaining: ${label}`}
        role="timer"
        aria-live="polite"
      >
        <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
        {label}
      </span>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-3 font-mono ${className}`}
      role="timer"
      aria-label={`Time remaining: ${label}`}
      aria-live="polite"
    >
      {timeLeft.days > 0 && (
        <TimeUnit value={timeLeft.days} label="days" urgency={urgency} />
      )}
      <TimeUnit value={timeLeft.hours} label="hrs" urgency={urgency} />
      <TimeUnit value={timeLeft.minutes} label="min" urgency={urgency} />
    </div>
  );
}

// ============================================================================
// TimeUnit sub-component (full mode only)
// ============================================================================

interface TimeUnitProps {
  value: number;
  label: string;
  urgency: 'normal' | 'warning' | 'critical' | 'expired';
}

function TimeUnit({ value, label, urgency }: TimeUnitProps) {
  const colorClass = URGENCY_COLORS[urgency];
  const bgClass = URGENCY_BG[urgency];

  return (
    <div className={`flex flex-col items-center px-3 py-2 rounded-lg ${bgClass}`}>
      <span className={`text-2xl font-bold leading-none ${colorClass}`}>
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-xs text-gray-500 mt-1 uppercase tracking-wider">{label}</span>
    </div>
  );
}

export default CountdownTimer;
