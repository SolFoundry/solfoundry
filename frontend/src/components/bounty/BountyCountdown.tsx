import { useState, useEffect, useCallback } from 'react';

interface TimeLeft {
  total: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function calculateTimeLeft(deadline: string | Date): TimeLeft {
  const deadlineTime =
    typeof deadline === 'string' ? new Date(deadline).getTime() : deadline.getTime();
  const now = Date.now();
  const total = deadlineTime - now;

  if (total <= 0) {
    return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  return {
    total,
    days: Math.floor(total / (1000 * 60 * 60 * 24)),
    hours: Math.floor((total % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((total % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((total % (1000 * 60)) / 1000),
  };
}

export interface BountyCountdownProps {
  deadline: string | Date;
  /** Callback when countdown reaches zero */
  onExpire?: () => void;
  /** Show label prefix, e.g. "Closes in" */
  label?: string;
  /** Compact inline style for cards */
  compact?: boolean;
}

/**
 * Real-time countdown timer for bounty deadlines.
 * Color shifts: normal → warning (<24h) → urgent (<1h) → expired
 */
export function BountyCountdown({
  deadline,
  onExpire,
  label,
  compact = false,
}: BountyCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => calculateTimeLeft(deadline));

  useEffect(() => {
    // Sync if deadline prop changes
    setTimeLeft(calculateTimeLeft(deadline));
  }, [deadline]);

  useEffect(() => {
    if (timeLeft.total <= 0) return;

    const timer = setInterval(() => {
      const remaining = calculateTimeLeft(deadline);
      setTimeLeft(remaining);
      if (remaining.total <= 0) {
        clearInterval(timer);
        onExpire?.();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [deadline, onExpire, timeLeft.total]);

  // Expired state
  if (timeLeft.total <= 0) {
    return (
      <span className="inline-flex items-center gap-1 text-red-400 font-mono text-sm">
        {!compact && <span className="opacity-60">Expired</span>}
        {compact && <span>Expired</span>}
      </span>
    );
  }

  // Urgency level
  const isUrgent = timeLeft.hours < 1;
  const isWarning = timeLeft.days < 1 && !isUrgent;

  const colorClass = isUrgent
    ? 'text-red-400'
    : isWarning
    ? 'text-yellow-400'
    : 'text-zinc-300';

  const bgClass = isUrgent
    ? 'bg-red-500/10'
    : isWarning
    ? 'bg-yellow-500/10'
    : 'bg-zinc-800/50';

  const pad = (n: number) => String(n).padStart(2, '0');

  const timeString =
    timeLeft.days > 0
      ? `${timeLeft.days}d ${pad(timeLeft.hours)}:${pad(timeLeft.minutes)}:${pad(timeLeft.seconds)}`
      : `${pad(timeLeft.hours)}:${pad(timeLeft.minutes)}:${pad(timeLeft.seconds)}`;

  if (compact) {
    return (
      <span className={`font-mono text-xs ${colorClass} tabular-nums`} title={`Deadline: ${deadline}`}>
        {timeString}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex flex-col items-start gap-0.5 ${compact ? '' : 'p-3 rounded-lg border'}`}
      title={`Deadline: ${deadline}`}
    >
      {label && (
        <span className="text-zinc-500 text-xs">{label}</span>
      )}
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded font-mono text-sm tabular-nums ${colorClass} ${bgClass}`}
      >
        {isWarning && !isUrgent && (
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
        )}
        {isUrgent && (
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
        )}
        {timeString}
      </span>
    </span>
  );
}

export default BountyCountdown;
