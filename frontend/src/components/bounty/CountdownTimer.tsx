import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { timeLeftMs, formatTimeLeft } from '../../lib/utils';

interface CountdownTimerProps {
  deadline: string | Date;
  showIcon?: boolean;
  className?: string;
}

type UrgencyLevel = 'normal' | 'warning' | 'urgent' | 'expired';

function getUrgencyLevel(ms: number): UrgencyLevel {
  if (ms <= 0) return 'expired';
  if (ms < 1 * 60 * 60 * 1000) return 'urgent'; // < 1 hour
  if (ms < 24 * 60 * 60 * 1000) return 'warning'; // < 24 hours
  return 'normal';
}

const urgencyStyles: Record<UrgencyLevel, string> = {
  normal: 'text-text-muted',
  warning: 'text-amber-400',
  urgent: 'text-red-400',
  expired: 'text-text-muted opacity-60',
};

const urgencyBgStyles: Record<UrgencyLevel, string> = {
  normal: 'bg-forge-800',
  warning: 'bg-amber-400/10 border-amber-400/20',
  urgent: 'bg-red-400/10 border-red-400/20 animate-pulse',
  expired: 'bg-forge-800 opacity-60',
};

export function CountdownTimer({
  deadline,
  showIcon = true,
  className = '',
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState(() => timeLeftMs(deadline));

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = timeLeftMs(deadline);
      setTimeLeft(remaining);

      // Stop updating when expired
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [deadline]);

  const urgency = getUrgencyLevel(timeLeft);
  const { days, hours, minutes, seconds } = formatTimeLeft(timeLeft);

  if (urgency === 'expired') {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${urgencyBgStyles.expired} ${className}`}>
        {showIcon && <Clock className="w-3.5 h-3.5" />}
        <span className="text-xs font-medium text-text-muted">Expired</span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${urgencyBgStyles[urgency]} ${className}`}
      title={`Deadline: ${new Date(deadline).toLocaleString()}`}
    >
      {showIcon && <Clock className={`w-3.5 h-3.5 ${urgencyStyles[urgency]}`} />}

      <div className="flex items-center gap-1">
        {days > 0 && (
          <span className={`text-xs font-mono font-semibold ${urgencyStyles[urgency]}`}>
            {days}d
          </span>
        )}
        <span className={`text-xs font-mono font-semibold ${urgencyStyles[urgency]}`}>
          {String(hours).padStart(2, '0')}
        </span>
        <span className={`text-xs font-mono ${urgencyStyles[urgency]} opacity-60`}>:</span>
        <span className={`text-xs font-mono font-semibold ${urgencyStyles[urgency]}`}>
          {String(minutes).padStart(2, '0')}
        </span>
        <span className={`text-xs font-mono ${urgencyStyles[urgency]} opacity-60`}>:</span>
        <span className={`text-xs font-mono font-semibold ${urgencyStyles[urgency]}`}>
          {String(seconds).padStart(2, '0')}
        </span>
      </div>
    </div>
  );
}
