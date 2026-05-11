import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, AlertCircle } from 'lucide-react';

interface BountyCountdownTimerProps {
  deadline: string; // ISO 8601 date string
  className?: string;
  compact?: boolean; // Compact mode for bounty cards
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
  isUrgent: boolean;  // < 1 hour
  isWarning: boolean; // < 24 hours
}

function calculateTimeRemaining(deadline: string): TimeRemaining {
  const now = new Date().getTime();
  const end = new Date(deadline).getTime();
  const diff = end - now;

  if (diff <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isExpired: true,
      isUrgent: false,
      isWarning: false,
    };
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
    isExpired: false,
    isUrgent: totalHours < 1,
    isWarning: totalHours < 24 && totalHours >= 1,
  };
}

function padZero(n: number): string {
  return n.toString().padStart(2, '0');
}

export function BountyCountdownTimer({
  deadline,
  className = '',
  compact = false,
}: BountyCountdownTimerProps) {
  const [time, setTime] = useState<TimeRemaining>(() =>
    calculateTimeRemaining(deadline)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(calculateTimeRemaining(deadline));
    }, 1000);

    return () => clearInterval(interval);
  }, [deadline]);

  if (time.isExpired) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-status-error/10 text-status-error border border-status-error/20 ${className}`}
      >
        <AlertCircle className="w-3.5 h-3.5" />
        <span>Expired</span>
      </div>
    );
  }

  // Determine color scheme based on urgency
  let colorClasses: string;
  let Icon: React.ElementType;

  if (time.isUrgent) {
    colorClasses =
      'bg-status-error/10 text-status-error border-status-error/20 animate-pulse';
    Icon = AlertCircle;
  } else if (time.isWarning) {
    colorClasses =
      'bg-tier-t2/10 text-tier-t2 border-tier-t2/20';
    Icon = AlertTriangle;
  } else {
    colorClasses =
      'bg-tier-t1/10 text-tier-t1 border-tier-t1/20';
    Icon = Clock;
  }

  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${colorClasses} ${className}`}
      >
        <Icon className="w-3.5 h-3.5" />
        <span>
          {time.days > 0
            ? `${time.days}d ${padZero(time.hours)}h`
            : time.hours > 0
            ? `${time.hours}h ${padZero(time.minutes)}m`
            : `${padZero(time.minutes)}:${padZero(time.seconds)}`}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${colorClasses} ${className}`}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <div className="flex items-center gap-2">
        {time.days > 0 && (
          <TimeUnit value={time.days} label="days" />
        )}
        <TimeUnit value={time.hours} label="hrs" />
        <span className="text-current/40">:</span>
        <TimeUnit value={time.minutes} label="min" />
        <span className="text-current/40">:</span>
        <TimeUnit value={time.seconds} label="sec" />
      </div>
      {time.isUrgent && (
        <span className="ml-1 text-xs font-semibold uppercase tracking-wide">
          Final Hour!
        </span>
      )}
      {time.isWarning && !time.isUrgent && (
        <span className="ml-1 text-xs font-semibold uppercase tracking-wide">
          Ending Soon
        </span>
      )}
    </div>
  );
}

function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-lg font-bold tabular-nums leading-tight">
        {padZero(value)}
      </span>
      <span className="text-[10px] uppercase tracking-wider opacity-60">
        {label}
      </span>
    </div>
  );
}

export default BountyCountdownTimer;
