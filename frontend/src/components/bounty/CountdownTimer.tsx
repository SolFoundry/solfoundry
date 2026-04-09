import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
  deadline: string;
  className?: string;
  icon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

interface TimeLeft {
  total: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
  warning: boolean;
  urgent: boolean;
}

function calculateTimeLeft(deadline: string): TimeLeft {
  const total = new Date(deadline).getTime() - Date.now();
  if (total <= 0) {
    return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0, expired: true, warning: false, urgent: false };
  }

  const seconds = Math.floor((total / 1000) % 60);
  const minutes = Math.floor((total / 1000 / 60) % 60);
  const hours = Math.floor((total / 1000 / 60 / 60) % 24);
  const days = Math.floor(total / 1000 / 60 / 60 / 24);

  return {
    total,
    days,
    hours,
    minutes,
    seconds,
    expired: false,
    warning: total < 24 * 60 * 60 * 1000 && total > 60 * 60 * 1000,
    urgent: total <= 60 * 60 * 1000,
  };
}

export function CountdownTimer({ deadline, className = '', icon = true, size = 'md' }: CountdownTimerProps) {
  const [time, setTime] = useState<TimeLeft>(calculateTimeLeft(deadline));

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(calculateTimeLeft(deadline));
    }, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (time.expired) {
    const sizeClasses = { sm: 'text-xs', md: 'text-sm', lg: 'text-lg' }[size];
    return (
      <span className={`inline-flex items-center gap-1 font-mono text-text-muted ${sizeClasses} ${className}`}>
        {icon && <Clock className="w-3.5 h-3.5" />}
        Expired
      </span>
    );
  }

  const colorClass = time.urgent ? 'text-status-error' : time.warning ? 'text-status-warning' : 'text-text-secondary';
  const digitClass = time.urgent ? 'text-status-error' : time.warning ? 'text-status-warning' : 'text-text-primary';
  const sizeClasses = { sm: 'text-xs gap-0.5', md: 'text-sm gap-1', lg: 'text-base gap-1.5' }[size];
  const digitSizeClass = { sm: 'text-xs', md: 'text-sm', lg: 'text-lg' }[size];

  const parts: string[] = [];
  if (time.days > 0) parts.push(`${time.days}d`);
  parts.push(`${String(time.hours).padStart(2, '0')}h`);
  parts.push(`${String(time.minutes).padStart(2, '0')}m`);
  if (size !== 'sm' || time.urgent) {
    parts.push(`${String(time.seconds).padStart(2, '0')}s`);
  }

  return (
    <span className={`inline-flex items-center ${sizeClasses} font-mono ${colorClass} ${className}`}>
      {icon && <Clock className={`w-3.5 h-3.5 ${time.urgent ? 'animate-pulse' : ''}`} />}
      <span className={digitSizeClass}>{parts.join(' ')}</span>
    </span>
  );
}
