import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface BountyCountdownTimerProps {
  deadline: string;
}

export function BountyCountdownTimer({ deadline }: BountyCountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft(deadline));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(deadline));
    }, 1000);

    return () => clearInterval(timer);
  }, [deadline]);

  if (timeLeft.isExpired) {
    return (
      <span className="inline-flex items-center gap-1 text-status-error font-mono text-xs font-medium">
        <Clock className="w-3.5 h-3.5" />
        Expired
      </span>
    );
  }

  const totalHours = timeLeft.days * 24 + timeLeft.hours;
  let colorClass = 'text-text-muted'; // default
  
  if (totalHours < 1) {
    colorClass = 'text-status-error'; // urgent (< 1 hr)
  } else if (totalHours < 24) {
    colorClass = 'text-status-warning'; // warning (< 24 hr)
  }

  const parts = [];
  if (timeLeft.days > 0) parts.push(`${timeLeft.days}d`);
  if (timeLeft.hours > 0 || timeLeft.days > 0) parts.push(`${timeLeft.hours}h`);
  parts.push(`${timeLeft.minutes}m`);

  return (
    <span className={`inline-flex items-center gap-1 font-mono text-xs font-medium ${colorClass}`}>
      <Clock className="w-3.5 h-3.5" />
      {parts.join(' ')}
    </span>
  );
}

function calculateTimeLeft(deadline: string) {
  const difference = new Date(deadline).getTime() - new Date().getTime();

  if (difference <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
  }

  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((difference / 1000 / 60) % 60),
    seconds: Math.floor((difference / 1000) % 60),
    isExpired: false,
  };
}
