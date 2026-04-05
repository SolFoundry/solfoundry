import React, { useEffect, useState, useMemo } from 'react';

interface CountdownTimerProps {
  /** ISO 8601 deadline string or Date object */
  deadline: string | Date;
  /** Optional CSS class name */
  className?: string;
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

type Urgency = 'normal' | 'warning' | 'urgent' | 'expired';

function getUrgency(totalMs: number): Urgency {
  if (totalMs <= 0) return 'expired';
  if (totalMs < 60 * 60 * 1000) return 'urgent'; // < 1 hour
  if (totalMs < 24 * 60 * 60 * 1000) return 'warning'; // < 24 hours
  return 'normal';
}

const urgencyStyles: Record<Urgency, string> = {
  normal: 'text-emerald-400 bg-emerald-950/50 border-emerald-800',
  warning: 'text-amber-400 bg-amber-950/50 border-amber-800 animate-pulse',
  urgent: 'text-red-400 bg-red-950/50 border-red-800 animate-pulse',
  expired: 'text-gray-500 bg-gray-900/50 border-gray-700',
};

export function CountdownTimer({ deadline, className = '' }: CountdownTimerProps) {
  const deadlineDate = useMemo(
    () => (deadline instanceof Date ? deadline : new Date(deadline)),
    [deadline],
  );
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

  const urgency = getUrgency(timeLeft.total);

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
  if (timeLeft.days === 0) parts.push(`${padTwo(timeLeft.seconds)}s`);

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-mono border ${urgencyStyles[urgency]} ${className}`}
      aria-label={`Time remaining: ${parts.join(' ')}`}
      aria-live="polite"
    >
      ⏰ {parts.join(' ')}
    </span>
  );
}
