import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

/**
 * Props for the BountyCountdown component.
 */
export interface BountyCountdownProps {
  deadline: string;
  /** Show just the text, or a richer card with label */
  variant?: 'inline' | 'badge';
  className?: string;
}

/**
 * Real-time countdown timer that shows days, hours, minutes until bounty deadline.
 * Color changes: normal → warning (<24h) → urgent (<1h)
 * Shows "Expired" when deadline passes.
 */
export function BountyCountdown({ deadline, variant = 'inline', className = '' }: BountyCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number; expired: boolean; urgent: boolean; warning: boolean }>(() => computeTimeLeft(deadline));

  useEffect(() => {
    // Recompute immediately when deadline prop changes
    setTimeLeft(computeTimeLeft(deadline));

    const interval = setInterval(() => {
      setTimeLeft(computeTimeLeft(deadline));
    }, 1000);

    return () => clearInterval(interval);
  }, [deadline]);

  const { days, hours, minutes, seconds, expired, urgent, warning } = timeLeft;

  const colorClass = urgent
    ? 'text-status-error'
    : warning
    ? 'text-status-warning'
    : 'text-text-secondary';

  if (expired) {
    if (variant === 'badge') {
      return (
        <span className={`inline-flex items-center gap-1 font-mono text-xs font-medium px-2 py-0.5 rounded-full border text-status-error ${className}`}
          style={{ borderColor: 'currentColor', backgroundColor: 'rgba(239,68,68,0.1)' }}>
          <Clock className="w-3 h-3" />
          Expired
        </span>
      );
    }
    return (
      <span className={`inline-flex items-center gap-1 text-status-error font-medium ${className}`}>
        <Clock className="w-3.5 h-3.5" />
        Expired
      </span>
    );
  }

  if (variant === 'badge') {
    return (
      <span className={`inline-flex items-center gap-1 font-mono text-xs font-medium px-2 py-0.5 rounded-full border ${colorClass} ${className}`}
        style={urgent ? { borderColor: 'currentColor', backgroundColor: 'rgba(239,68,68,0.1)' } : warning ? { borderColor: 'currentColor', backgroundColor: 'rgba(234,179,8,0.1)' } : {}}>
        <Clock className="w-3 h-3" />
        {days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m ${seconds}s`}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 font-mono text-xs ${colorClass} ${className}`}>
      <Clock className="w-3.5 h-3.5" />
      {days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m ${seconds}s`}
    </span>
  );
}

function computeTimeLeft(deadline: string) {
  const now = Date.now();
  const deadlineMs = new Date(deadline).getTime();
  const diff = deadlineMs - now;

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true, urgent: false, warning: false };
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const totalHours = diff / (1000 * 60 * 60);
  return {
    days,
    hours,
    minutes,
    seconds,
    expired: false,
    urgent: totalHours < 1,
    warning: totalHours < 24,
  };
}
