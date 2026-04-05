import React, { useState, useEffect, useMemo } from 'react';
import { Clock } from 'lucide-react';

export interface CountdownTimerProps {
  deadline: string | Date;
  showIcon?: boolean;
  compact?: boolean;
  className?: string;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

type UrgencyLevel = 'normal' | 'warning' | 'urgent' | 'expired';

function calculateTimeRemaining(deadline: Date): TimeRemaining {
  const now = new Date().getTime();
  const target = deadline.getTime();
  const total = target - now;

  if (total <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
  }

  return {
    days: Math.floor(total / (1000 * 60 * 60 * 24)),
    hours: Math.floor((total % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((total % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((total % (1000 * 60)) / 1000),
    total,
  };
}

function getUrgencyLevel(time: TimeRemaining): UrgencyLevel {
  if (time.total <= 0) return 'expired';
  if (time.total < 1000 * 60 * 60) return 'urgent'; // < 1 hour
  if (time.total < 1000 * 60 * 60 * 24) return 'warning'; // < 24 hours
  return 'normal';
}

const urgencyStyles: Record<UrgencyLevel, { text: string; bg: string; pulse?: boolean }> = {
  normal: {
    text: 'text-text-secondary',
    bg: 'bg-forge-700',
  },
  warning: {
    text: 'text-amber-400',
    bg: 'bg-amber-400/10',
  },
  urgent: {
    text: 'text-red-400',
    bg: 'bg-red-400/10',
    pulse: true,
  },
  expired: {
    text: 'text-text-muted',
    bg: 'bg-forge-800',
  },
};

export function CountdownTimer({
  deadline,
  showIcon = true,
  compact = false,
  className = '',
}: CountdownTimerProps) {
  const deadlineDate = useMemo(() => new Date(deadline), [deadline]);
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>(() =>
    calculateTimeRemaining(deadlineDate)
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining(deadlineDate));
    }, 1000);

    return () => clearInterval(timer);
  }, [deadlineDate]);

  const urgency = getUrgencyLevel(timeRemaining);
  const styles = urgencyStyles[urgency];

  if (urgency === 'expired') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md ${styles.bg} ${styles.text} text-sm font-medium ${className}`}
      >
        {showIcon && <Clock className="w-4 h-4" />}
        Expired
      </span>
    );
  }

  const { days, hours, minutes, seconds } = timeRemaining;

  if (compact) {
    // Compact format: "2d 5h" or "5h 30m" or "30m 15s"
    let display: string;
    if (days > 0) {
      display = `${days}d ${hours}h`;
    } else if (hours > 0) {
      display = `${hours}h ${minutes}m`;
    } else {
      display = `${minutes}m ${seconds}s`;
    }

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md ${styles.bg} ${styles.text} text-sm font-medium ${className} ${
          styles.pulse ? 'animate-pulse' : ''
        }`}
      >
        {showIcon && <Clock className="w-4 h-4" />}
        {display}
      </span>
    );
  }

  // Full format: "2d 05h 30m 15s"
  const pad = (n: number) => n.toString().padStart(2, '0');

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${styles.bg} ${styles.text} text-sm font-mono font-medium ${className} ${
        styles.pulse ? 'animate-pulse' : ''
      }`}
    >
      {showIcon && <Clock className="w-4 h-4 flex-shrink-0" />}
      {days > 0 && <span>{days}d</span>}
      <span>{pad(hours)}h</span>
      <span>{pad(minutes)}m</span>
      <span>{pad(seconds)}s</span>
    </span>
  );
}

// Smaller inline variant for bounty cards
export function CountdownBadge({ deadline, className = '' }: { deadline: string | Date; className?: string }) {
  const deadlineDate = useMemo(() => new Date(deadline), [deadline]);
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>(() =>
    calculateTimeRemaining(deadlineDate)
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining(deadlineDate));
    }, 1000);
    return () => clearInterval(timer);
  }, [deadlineDate]);

  const urgency = getUrgencyLevel(timeRemaining);
  const styles = urgencyStyles[urgency];

  if (urgency === 'expired') {
    return (
      <span className={`text-xs ${styles.text} ${className}`}>Expired</span>
    );
  }

  const { days, hours, minutes } = timeRemaining;
  let display: string;
  if (days > 0) {
    display = `${days}d ${hours}h`;
  } else if (hours > 0) {
    display = `${hours}h ${minutes}m`;
  } else {
    display = `<1h`;
  }

  return (
    <span
      className={`text-xs ${styles.text} ${styles.pulse ? 'animate-pulse' : ''} ${className}`}
    >
      {display}
    </span>
  );
}