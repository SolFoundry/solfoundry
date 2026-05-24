import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface BountyCountdownProps {
  deadline: string | Date;
  className?: string;
}

export function BountyCountdown({ deadline, className = '' }: BountyCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    isExpired: boolean;
  } | null>(null);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const target = new Date(deadline).getTime();
      const difference = target - now;

      if (difference <= 0) {
        return { days: 0, hours: 0, minutes: 0, isExpired: true };
      }

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        isExpired: false,
      };
    };

    // Initial calculation
    setTimeLeft(calculateTimeLeft());

    // Update every second for precision
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [deadline]);

  if (!timeLeft) return null;

  if (timeLeft.isExpired) {
    return (
      <span className={`inline-flex items-center gap-1 text-status-error font-medium ${className}`}>
        <Clock className="w-3.5 h-3.5" />
        Expired
      </span>
    );
  }

  // Determine color based on time left
  const totalHoursLeft = timeLeft.days * 24 + timeLeft.hours;
  
  let colorClass = 'text-emerald'; // > 24 hours
  if (totalHoursLeft < 1) {
    colorClass = 'text-status-error'; // < 1 hour (urgent)
  } else if (totalHoursLeft < 24) {
    colorClass = 'text-status-warning'; // < 24 hours (warning)
  }

  // Format string: e.g. "2d 5h 30m"
  const parts = [];
  if (timeLeft.days > 0) parts.push(`${timeLeft.days}d`);
  if (timeLeft.hours > 0 || timeLeft.days > 0) parts.push(`${timeLeft.hours}h`);
  parts.push(`${timeLeft.minutes}m`);

  return (
    <span className={`inline-flex items-center gap-1 font-mono ${colorClass} ${className}`}>
      <Clock className="w-3.5 h-3.5" />
      {parts.join(' ')}
    </span>
  );
}
