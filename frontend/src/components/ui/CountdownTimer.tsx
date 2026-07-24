import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
  deadline: string;
  className?: string;
  showIcon?: boolean;
}

function getTimeRemaining(deadline: string): { total: number; days: number; hours: number; minutes: number; seconds: number } {
  const total = new Date(deadline).getTime() - Date.now();
  if (total <= 0) return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };

  const seconds = Math.floor((total / 1000) % 60);
  const minutes = Math.floor((total / (1000 * 60)) % 60);
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const days = Math.floor(total / (1000 * 60 * 60 * 24));

  return { total, days, hours, minutes, seconds };
}

export function CountdownTimer({ deadline, className = '', showIcon = true }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(() => getTimeRemaining(deadline));

  useEffect(() => {
    setRemaining(getTimeRemaining(deadline));
    const interval = setInterval(() => {
      setRemaining(getTimeRemaining(deadline));
    }, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  const isExpired = remaining.total <= 0;
  const isUrgent = !isExpired && remaining.total < 3600_000; // < 1 hour
  const isWarning = !isExpired && !isUrgent && remaining.total < 86_400_000; // < 24 hours

  const colorClass = isExpired
    ? 'text-status-error'
    : isUrgent
      ? 'text-status-error font-semibold'
      : isWarning
        ? 'text-amber'
        : 'text-text-muted';

  const label = isExpired
    ? 'Expired'
    : isUrgent
      ? `${remaining.hours}h ${remaining.minutes}m ${remaining.seconds}s`
      : isWarning
        ? `${remaining.hours}h ${remaining.minutes}m`
        : `${remaining.days}d ${remaining.hours}h`;

  return (
    <span className={`inline-flex items-center gap-1 text-xs ${colorClass} ${className}`} title={new Date(deadline).toLocaleString()}>
      {showIcon && <Clock className="w-3.5 h-3.5" />}
      {label}
    </span>
  );
}