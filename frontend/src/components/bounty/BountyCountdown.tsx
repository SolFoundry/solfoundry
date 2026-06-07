import React, { useEffect, useMemo, useState } from 'react';
import { Clock } from 'lucide-react';

type Urgency = 'normal' | 'warning' | 'urgent' | 'expired';

interface TimeParts {
  label: string;
  ariaLabel: string;
  urgency: Urgency;
}

function getTimeParts(deadline: string, now: number): TimeParts {
  const deadlineTime = new Date(deadline).getTime();
  const diff = deadlineTime - now;

  if (!Number.isFinite(deadlineTime) || diff <= 0) {
    return { label: 'Expired', ariaLabel: 'Bounty deadline expired', urgency: 'expired' };
  }

  const totalMinutes = Math.floor(diff / 60_000);
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;

  const urgency: Urgency = totalHours < 1 ? 'urgent' : totalHours < 24 ? 'warning' : 'normal';
  const label = days > 0 ? `${days}d ${hours}h ${minutes}m` : `${totalHours}h ${minutes}m`;

  return {
    label,
    ariaLabel: `${days} days, ${hours} hours, ${minutes} minutes remaining`,
    urgency,
  };
}

const urgencyClasses: Record<Urgency, string> = {
  normal: 'text-text-muted',
  warning: 'text-status-warning',
  urgent: 'text-status-error',
  expired: 'text-text-muted',
};

export function BountyCountdown({ deadline, className = '' }: { deadline: string; className?: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const time = useMemo(() => getTimeParts(deadline, now), [deadline, now]);
  const pulse = time.urgency === 'warning' || time.urgency === 'urgent' ? 'animate-pulse' : '';

  return (
    <span
      aria-label={time.ariaLabel}
      aria-live="polite"
      className={`inline-flex items-center gap-1 font-mono ${urgencyClasses[time.urgency]} ${pulse} ${className}`}
      data-testid="bounty-countdown"
    >
      <Clock className="w-3.5 h-3.5" />
      {time.label}
    </span>
  );
}
