import React, { useState, useEffect, useCallback } from 'react';
import { Clock } from 'lucide-react';

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
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

interface CountdownTimerProps {
  deadline: string;
  compact?: boolean;
}

export function CountdownTimer({ deadline, compact }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(() => calcTimeLeft(deadline));

  useEffect(() => {
    setTimeLeft(calcTimeLeft(deadline));
    const timer = setInterval(() => {
      setTimeLeft(calcTimeLeft(deadline));
    }, 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  const formatTime = useCallback((tl: TimeLeft): string => {
    if (compact) {
      if (tl.days > 0) return `${tl.days}d ${tl.hours}h`;
      if (tl.hours > 0) return `${tl.hours}h ${tl.minutes}m`;
      return `${tl.minutes}m ${tl.seconds}s`;
    }
    const parts: string[] = [];
    if (tl.days > 0) parts.push(`${tl.days}d`);
    parts.push(`${tl.hours}h`);
    parts.push(`${tl.minutes}m`);
    if (tl.days === 0) parts.push(`${tl.seconds}s`);
    return parts.join(' ');
  }, [compact]);

  const hoursLeft = timeLeft ? timeLeft.days * 24 + timeLeft.hours : 0;

  const colorClass = !timeLeft
    ? 'text-status-error'
    : hoursLeft < 1
      ? 'text-status-error'
      : hoursLeft < 24
        ? 'text-status-warning'
        : 'text-text-secondary';

  const label = !timeLeft ? 'Expired' : formatTime(timeLeft);

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 font-mono text-xs ${colorClass}`}>
        <Clock className="w-3.5 h-3.5" />
        {label}
      </span>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 font-mono text-sm ${colorClass}`}>
      <Clock className="w-4 h-4" />
      <span className="font-medium">{label}</span>
      {hoursLeft < 24 && timeLeft && (
        <span className="text-xs opacity-70">
          ({hoursLeft < 1 ? 'Urgent' : 'Due Soon'})
        </span>
      )}
    </div>
  );
}
