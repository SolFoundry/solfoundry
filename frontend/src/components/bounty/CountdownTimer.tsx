import React, { useEffect, useMemo, useState } from 'react';
import { cn } from '../../lib/utils';

export type CountdownUrgency = 'normal' | 'warning' | 'urgent' | 'expired' | 'invalid';

interface CountdownState {
  label: string;
  urgency: CountdownUrgency;
  remainingMs: number;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function getCountdownState(deadline: string, now = Date.now()): CountdownState {
  const end = new Date(deadline).getTime();

  if (Number.isNaN(end)) {
    return { label: 'No deadline', urgency: 'invalid', remainingMs: 0 };
  }

  const remainingMs = end - now;

  if (remainingMs <= 0) {
    return { label: 'Expired', urgency: 'expired', remainingMs: 0 };
  }

  const totalMinutes = Math.max(1, Math.ceil(remainingMs / MINUTE_MS));
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;

  const labelParts = [
    days > 0 ? `${days}d` : null,
    hours > 0 || days > 0 ? `${hours}h` : null,
    `${minutes}m`,
  ].filter(Boolean);

  const urgency: CountdownUrgency =
    remainingMs < HOUR_MS ? 'urgent' : remainingMs < DAY_MS ? 'warning' : 'normal';

  return {
    label: labelParts.join(' '),
    urgency,
    remainingMs,
  };
}

interface CountdownTimerProps {
  deadline: string;
  size?: 'sm' | 'md';
  className?: string;
}

const urgencyStyles: Record<CountdownUrgency, string> = {
  normal: 'text-text-muted',
  warning: 'text-status-warning',
  urgent: 'text-status-error',
  expired: 'text-text-muted',
  invalid: 'text-text-muted',
};

const sizeStyles = {
  sm: 'text-xs',
  md: 'text-sm',
};

export function CountdownTimer({ deadline, size = 'sm', className }: CountdownTimerProps) {
  const [now, setNow] = useState(() => Date.now());
  const countdown = useMemo(() => getCountdownState(deadline, now), [deadline, now]);

  useEffect(() => {
    setNow(Date.now());

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1_000);

    return () => window.clearInterval(timer);
  }, [deadline]);

  return (
    <span
      role="timer"
      aria-live={countdown.urgency === 'urgent' || countdown.urgency === 'expired' ? 'polite' : 'off'}
      data-testid="bounty-countdown"
      data-urgency={countdown.urgency}
      className={cn(
        'font-mono font-medium tabular-nums transition-colors duration-300',
        urgencyStyles[countdown.urgency],
        sizeStyles[size],
        className,
      )}
    >
      {countdown.label}
    </span>
  );
}
