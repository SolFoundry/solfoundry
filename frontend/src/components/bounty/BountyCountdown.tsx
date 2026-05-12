import React, { useEffect, useMemo, useState } from 'react';
import { Clock } from 'lucide-react';

export type CountdownUrgency = 'normal' | 'warning' | 'urgent' | 'expired';

interface TimeRemaining {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  urgency: CountdownUrgency;
  label: string;
}

interface BountyCountdownProps {
  deadline?: string | null;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function getBountyTimeRemaining(deadline: string, now = Date.now()): TimeRemaining {
  const deadlineMs = new Date(deadline).getTime();

  if (Number.isNaN(deadlineMs)) {
    return {
      totalMs: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      urgency: 'expired',
      label: 'Expired',
    };
  }

  const totalMs = deadlineMs - now;

  if (totalMs <= 0) {
    return {
      totalMs,
      days: 0,
      hours: 0,
      minutes: 0,
      urgency: 'expired',
      label: 'Expired',
    };
  }

  const days = Math.floor(totalMs / DAY_MS);
  const hours = Math.floor((totalMs % DAY_MS) / HOUR_MS);
  const minutes = Math.max(1, Math.floor((totalMs % HOUR_MS) / MINUTE_MS));

  const urgency: CountdownUrgency =
    totalMs < HOUR_MS ? 'urgent' : totalMs < DAY_MS ? 'warning' : 'normal';

  const label = days > 0
    ? `${days}d ${hours}h left`
    : hours > 0
      ? `${hours}h ${minutes}m left`
      : `${minutes}m left`;

  return { totalMs, days, hours, minutes, urgency, label };
}

const urgencyClasses: Record<CountdownUrgency, string> = {
  normal: 'text-text-muted border-border bg-forge-800/50',
  warning: 'text-status-warning border-status-warning/30 bg-status-warning/10',
  urgent: 'text-status-error border-status-error/30 bg-status-error/10',
  expired: 'text-text-muted border-border bg-forge-800/50',
};

const iconClasses: Record<CountdownUrgency, string> = {
  normal: 'text-text-muted',
  warning: 'text-status-warning',
  urgent: 'text-status-error animate-pulse',
  expired: 'text-text-muted',
};

const sizeClasses = {
  sm: 'text-xs px-2 py-1 gap-1',
  md: 'text-sm px-2.5 py-1.5 gap-1.5',
  lg: 'text-base px-3 py-2 gap-2',
};

const iconSizeClasses = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

export function BountyCountdown({
  deadline,
  size = 'sm',
  showIcon = true,
  className = '',
}: BountyCountdownProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!deadline) return;

    const tick = () => setNow(Date.now());
    const interval = window.setInterval(tick, MINUTE_MS);
    tick();

    return () => window.clearInterval(interval);
  }, [deadline]);

  const remaining = useMemo(() => {
    if (!deadline) return null;
    return getBountyTimeRemaining(deadline, now);
  }, [deadline, now]);

  if (!remaining) return null;

  return (
    <span
      className={`inline-flex items-center rounded-full border font-mono font-medium transition-colors ${sizeClasses[size]} ${urgencyClasses[remaining.urgency]} ${className}`}
      data-testid="bounty-countdown"
      data-urgency={remaining.urgency}
      aria-label={`Bounty deadline: ${remaining.label}`}
      title={`Deadline: ${new Date(deadline ?? '').toLocaleString()}`}
    >
      {showIcon && <Clock className={`${iconSizeClasses[size]} ${iconClasses[remaining.urgency]}`} aria-hidden="true" />}
      <span>{remaining.label}</span>
    </span>
  );
}
