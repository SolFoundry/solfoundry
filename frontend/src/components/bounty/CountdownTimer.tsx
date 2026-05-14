import React, { useEffect, useMemo, useState } from 'react';
import { Clock } from 'lucide-react';

type CountdownTimerProps = {
  deadline: string | Date;
  compact?: boolean;
};

export function getCountdownState(deadline: string | Date, now = Date.now()) {
  const target = new Date(deadline).getTime();
  const diffMs = target - now;

  if (!Number.isFinite(target) || diffMs <= 0) {
    return {
      expired: true,
      urgent: false,
      warning: false,
      label: 'Expired',
    };
  }

  const totalMinutes = Math.ceil(diffMs / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;

  const parts = [
    days > 0 ? `${days}d` : null,
    hours > 0 || days > 0 ? `${hours}h` : null,
    `${minutes}m`,
  ].filter(Boolean);

  return {
    expired: false,
    urgent: diffMs < 3_600_000,
    warning: diffMs < 86_400_000,
    label: parts.join(' '),
  };
}

export function CountdownTimer({ deadline, compact = false }: CountdownTimerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const countdown = useMemo(() => getCountdownState(deadline, now), [deadline, now]);

  const tone = countdown.expired
    ? 'text-text-muted'
    : countdown.urgent
      ? 'text-status-error'
      : countdown.warning
        ? 'text-status-warning'
        : 'text-text-muted';

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono ${compact ? 'text-xs' : 'text-sm'} ${tone}`}
      aria-live={countdown.urgent ? 'assertive' : 'polite'}
      title={new Date(deadline).toLocaleString()}
    >
      <Clock className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      {countdown.label}
    </span>
  );
}
