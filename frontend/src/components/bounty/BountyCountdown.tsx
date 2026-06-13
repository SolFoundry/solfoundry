import React, { useEffect, useMemo, useState } from 'react';
import { Clock } from 'lucide-react';

export type CountdownUrgency = 'normal' | 'warning' | 'urgent' | 'expired';

interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  totalMs: number;
  urgency: CountdownUrgency;
}

interface BountyCountdownProps {
  deadline?: string | null;
  size?: 'compact' | 'default';
  showIcon?: boolean;
  className?: string;
}

export function getCountdownParts(deadline?: string | null, now = Date.now()): CountdownParts | null {
  if (!deadline) return null;

  const deadlineMs = new Date(deadline).getTime();
  if (Number.isNaN(deadlineMs)) return null;

  const totalMs = deadlineMs - now;
  if (totalMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, totalMs, urgency: 'expired' };
  }

  const totalMinutes = Math.max(1, Math.floor(totalMs / 60_000));
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;

  const urgency: CountdownUrgency =
    totalMs < 60 * 60_000 ? 'urgent' : totalMs < 24 * 60 * 60_000 ? 'warning' : 'normal';

  return { days, hours, minutes, totalMs, urgency };
}

function formatCountdown(parts: CountdownParts): string {
  if (parts.urgency === 'expired') return 'Expired';

  if (parts.days > 0) {
    return `${parts.days}d ${parts.hours}h ${parts.minutes}m`;
  }

  if (parts.hours > 0) {
    return `${parts.hours}h ${parts.minutes}m`;
  }

  return `${parts.minutes}m`;
}

const urgencyClasses: Record<CountdownUrgency, string> = {
  normal: 'border-border bg-forge-800/70 text-text-secondary',
  warning: 'border-status-warning/40 bg-status-warning/10 text-status-warning',
  urgent: 'border-status-error/40 bg-status-error/10 text-status-error animate-pulse',
  expired: 'border-text-muted/30 bg-forge-800 text-text-muted',
};

export function BountyCountdown({
  deadline,
  size = 'default',
  showIcon = true,
  className = '',
}: BountyCountdownProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!deadline) return undefined;

    const deadlineMs = new Date(deadline).getTime();
    if (Number.isNaN(deadlineMs)) return undefined;

    const interval = window.setInterval(() => {
      const nextNow = Date.now();
      setNow(nextNow);
      if (nextNow >= deadlineMs) {
        window.clearInterval(interval);
      }
    }, 1_000);

    return () => window.clearInterval(interval);
  }, [deadline]);

  const parts = useMemo(() => getCountdownParts(deadline, now), [deadline, now]);
  if (!parts) return null;

  const sizeClasses = size === 'compact' ? 'px-2 py-0.5 text-xs' : 'px-3 py-2 text-sm';
  const iconSize = size === 'compact' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-mono font-medium transition-colors ${sizeClasses} ${urgencyClasses[parts.urgency]} ${className}`}
      title={`Deadline: ${new Date(deadline ?? '').toLocaleString()}`}
      aria-label={`Bounty deadline countdown: ${formatCountdown(parts)}`}
    >
      {showIcon && <Clock className={iconSize} aria-hidden="true" />}
      {formatCountdown(parts)}
    </span>
  );
}
