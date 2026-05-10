import React, { useEffect, useMemo, useState } from 'react';
import { Clock } from 'lucide-react';

interface CountdownParts {
  label: string;
  ariaLabel: string;
  urgencyClass: string;
}

function getCountdownParts(deadline: string, now: number): CountdownParts {
  const remainingMs = new Date(deadline).getTime() - now;
  if (remainingMs <= 0) {
    return {
      label: 'Expired',
      ariaLabel: 'Bounty deadline expired',
      urgencyClass: 'text-text-muted',
    };
  }

  const totalMinutes = Math.ceil(remainingMs / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;

  const label = [
    days > 0 ? `${days}d` : '',
    hours > 0 || days > 0 ? `${hours}h` : '',
    `${minutes}m`,
  ].filter(Boolean).join(' ');

  const ariaParts = [
    days > 0 ? `${days} ${days === 1 ? 'day' : 'days'}` : '',
    hours > 0 || days > 0 ? `${hours} ${hours === 1 ? 'hour' : 'hours'}` : '',
    `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`,
  ].filter(Boolean).join(', ');

  const urgencyClass =
    remainingMs < 60 * 60_000
      ? 'text-status-error'
      : remainingMs < 24 * 60 * 60_000
        ? 'text-status-warning'
        : 'text-text-muted';

  return {
    label,
    ariaLabel: `${ariaParts} remaining`,
    urgencyClass,
  };
}

interface BountyCountdownProps {
  deadline: string;
  className?: string;
}

export function BountyCountdown({ deadline, className = '' }: BountyCountdownProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const parts = useMemo(() => getCountdownParts(deadline, now), [deadline, now]);

  return (
    <span
      aria-label={parts.ariaLabel}
      className={`inline-flex items-center gap-1 font-mono ${parts.urgencyClass} ${className}`}
    >
      <Clock className="w-3.5 h-3.5" />
      {parts.label}
    </span>
  );
}
