import { useState, useEffect } from 'react';

interface BountyCountdownTimerProps {
  deadline: string | Date;
  className?: string;
}

export function BountyCountdownTimer({ deadline, className = '' }: BountyCountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number } | null>(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const target = new Date(deadline).getTime();

    function calculate() {
      const now = Date.now();
      const diff = target - now;

      if (diff <= 0) {
        setExpired(true);
        setTimeLeft(null);
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      setTimeLeft({ days, hours, minutes });
      setExpired(false);
    }

    calculate();
    const interval = setInterval(calculate, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [deadline]);

  if (expired) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm font-medium ${className}`}>
        <ClockIcon />
        Expired
      </span>
    );
  }

  if (!timeLeft) {
    return <span className={`text-sm text-slate-400 ${className}`}>Loading...</span>;
  }

  const totalHours = timeLeft.days * 24 + timeLeft.hours;
  const isUrgent = totalHours < 1;
  const isWarning = totalHours < 24 && !isUrgent;

  const colorClass = isUrgent
    ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
    : isWarning
      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
      : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400';

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium ${colorClass} ${className}`}>
      <ClockIcon />
      {timeLeft.days > 0 && <>{timeLeft.days}d </>}
      {timeLeft.hours}h {timeLeft.minutes}m
    </span>
  );
}

function ClockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
