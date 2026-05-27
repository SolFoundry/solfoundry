import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, Timer, Ban } from 'lucide-react';

interface CountdownTimerProps {
  deadline: string;
  /** @default 'minimal' */
  variant?: 'minimal' | 'full';
  /** @default false */
  showIcon?: boolean;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function calcTimeLeft(deadline: string): TimeLeft | null {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1_000),
  };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function CountdownTimer({ deadline, variant = 'minimal', showIcon = true }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(() => calcTimeLeft(deadline));

  useEffect(() => {
    setTimeLeft(calcTimeLeft(deadline));
    const interval = setInterval(() => {
      setTimeLeft(calcTimeLeft(deadline));
    }, 1_000);
    return () => clearInterval(interval);
  }, [deadline]);

  // If deadline is set but we can't parse it, show nothing
  if (!deadline) return null;

  // Expired
  if (timeLeft === null) {
    const expired = new Date(deadline).getTime() < Date.now();
    if (expired) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-mono text-status-error">
          {showIcon && <Ban className="w-3 h-3" />}
          Expired
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-mono text-text-muted">
        {showIcon && <Clock className="w-3 h-3" />}
        No deadline
      </span>
    );
  }

  const totalHours = timeLeft.days * 24 + timeLeft.hours;
  const isUrgent = totalHours < 1;
  const isWarning = totalHours < 24 && !isUrgent;

  const colorClass = isUrgent
    ? 'text-status-error'
    : isWarning
      ? 'text-status-warning'
      : 'text-text-muted';

  const bgClass = isUrgent
    ? 'bg-status-error/10'
    : isWarning
      ? 'bg-status-warning/10'
      : 'bg-transparent';

  if (variant === 'full') {
    return (
      <div className={`inline-flex items-center gap-3 px-3 py-2 rounded-lg ${bgClass} ${colorClass} font-mono`}>
        {showIcon && (isUrgent ? <AlertTriangle className="w-4 h-4" /> : <Timer className="w-4 h-4" />)}
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          {timeLeft.days > 0 && (
            <>
              <span>{timeLeft.days}</span>
              <span className="text-[10px] uppercase tracking-wider opacity-60">d</span>
            </>
          )}
          <span>{pad(timeLeft.hours)}</span>
          <span className="text-[10px] opacity-60">h</span>
          <span>{pad(timeLeft.minutes)}</span>
          <span className="text-[10px] opacity-60">m</span>
          <span className="text-[11px]">{pad(timeLeft.seconds)}</span>
          <span className="text-[10px] opacity-60">s</span>
        </div>
        {isUrgent && <span className="text-[10px] font-bold uppercase tracking-wider">Urgent!</span>}
      </div>
    );
  }

  // Minimal variant
  const label = timeLeft.days > 0
    ? `${timeLeft.days}d ${timeLeft.hours}h left`
    : isUrgent
      ? `${timeLeft.minutes}m ${timeLeft.seconds}s left`
      : `${timeLeft.hours}h ${timeLeft.minutes}m left`;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-mono ${colorClass}`}>
      {showIcon && (isUrgent ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3.5 h-3.5" />)}
      {label}
    </span>
  );
}
