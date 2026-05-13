import React, { useState, useEffect } from 'react';

interface BountyCountdownProps {
  deadline: string | Date;
  variant?: 'card' | 'detail';
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
  urgent: boolean;   // < 1 hour
  warning: boolean;  // < 24 hours
}

function getTimeRemaining(deadline: string | Date): TimeRemaining {
  const target = new Date(deadline).getTime();
  const now = Date.now();
  const diff = target - now;

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true, urgent: false, warning: false };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  const totalHours = diff / (1000 * 60 * 60);

  return {
    days,
    hours,
    minutes,
    seconds,
    expired: false,
    urgent: totalHours < 1,
    warning: totalHours < 24 && totalHours >= 1,
  };
}

export function BountyCountdown({ deadline, variant = 'card' }: BountyCountdownProps) {
  const [time, setTime] = useState<TimeRemaining>(() => getTimeRemaining(deadline));

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = getTimeRemaining(deadline);
      setTime(remaining);
      if (remaining.expired) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [deadline]);

  if (time.expired) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-status-error">
        <span className="w-1.5 h-1.5 rounded-full bg-status-error" />
        Expired
      </span>
    );
  }

  const colorClass = time.urgent
    ? 'text-status-error'
    : time.warning
    ? 'text-yellow-400'
    : 'text-text-muted';

  const dotClass = time.urgent
    ? 'bg-status-error animate-pulse'
    : time.warning
    ? 'bg-yellow-400'
    : 'bg-text-muted';

  if (variant === 'card') {
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-mono ${colorClass}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
        {time.days > 0 && <span>{time.days}d</span>}
        <span>{time.hours}h</span>
        <span>{time.minutes}m</span>
      </span>
    );
  }

  // Detail variant — larger, more prominent
  return (
    <div className={`flex items-center gap-3 ${colorClass}`}>
      <span className={`w-2 h-2 rounded-full ${dotClass}`} />
      <div className="flex items-center gap-1 font-mono text-sm">
        {time.days > 0 && (
          <span className="inline-flex items-center gap-0.5">
            <span className="text-lg font-semibold">{time.days}</span>
            <span className="text-xs text-text-muted">d</span>
          </span>
        )}
        <span className="inline-flex items-center gap-0.5">
          <span className="text-lg font-semibold">{String(time.hours).padStart(2, '0')}</span>
          <span className="text-xs text-text-muted">h</span>
        </span>
        <span className="text-text-muted">:</span>
        <span className="inline-flex items-center gap-0.5">
          <span className="text-lg font-semibold">{String(time.minutes).padStart(2, '0')}</span>
          <span className="text-xs text-text-muted">m</span>
        </span>
        <span className="text-text-muted">:</span>
        <span className="inline-flex items-center gap-0.5">
          <span className="text-lg font-semibold">{String(time.seconds).padStart(2, '0')}</span>
          <span className="text-xs text-text-muted">s</span>
        </span>
      </div>
      {time.urgent && (
        <span className="text-xs font-medium text-status-error bg-status-error/10 px-2 py-0.5 rounded">
          URGENT
        </span>
      )}
      {time.warning && !time.urgent && (
        <span className="text-xs font-medium text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded">
          ENDING SOON
        </span>
      )}
    </div>
  );
}
