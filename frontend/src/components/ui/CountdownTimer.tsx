import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
  deadline: string | null | undefined;
  className?: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

function calcTimeLeft(deadline: string): TimeLeft {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
    expired: false,
  };
}

export function CountdownTimer({ deadline, className = '' }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(
    deadline ? calcTimeLeft(deadline) : null
  );

  useEffect(() => {
    if (!deadline) return;
    setTimeLeft(calcTimeLeft(deadline));
    const interval = setInterval(() => setTimeLeft(calcTimeLeft(deadline)), 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (!deadline || !timeLeft) return null;

  if (timeLeft.expired) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium text-status-error ${className}`}>
        <Clock className="w-3 h-3" />
        Expired
      </span>
    );
  }

  const totalMs = new Date(deadline).getTime() - Date.now();
  const isUrgent = totalMs < 3600000;      // < 1 hour
  const isWarning = totalMs < 86400000;    // < 24 hours

  const colorClass = isUrgent
    ? 'text-status-error'
    : isWarning
    ? 'text-amber-400'
    : 'text-text-muted';

  const parts =
    timeLeft.days > 0
      ? `${timeLeft.days}d ${timeLeft.hours}h ${timeLeft.minutes}m`
      : timeLeft.hours > 0
      ? `${timeLeft.hours}h ${timeLeft.minutes}m ${timeLeft.seconds}s`
      : `${timeLeft.minutes}m ${timeLeft.seconds}s`;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${colorClass} ${className}`}>
      <Clock className="w-3 h-3 shrink-0" />
      {parts}
    </span>
  );
}
