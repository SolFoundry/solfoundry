import React, { useState, useEffect, useCallback, useMemo } from 'react';

/**
 * CountdownTimer - Displays time remaining until a deadline
 *
 * Features:
 * - Shows days, hours, minutes remaining
 * - Updates every minute
 * - Color states: green (>24h), amber (<24h), red (<6h), expired
 * - Compact mode for cards, full display for detail page
 * - No external dependencies
 */

export interface CountdownTimerProps {
  /** ISO 8601 date string for the deadline */
  deadline: string;
  /** Compact mode for use in cards */
  compact?: boolean;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  totalMinutes: number;
  isExpired: boolean;
}

function calculateTimeRemaining(deadline: string): TimeRemaining {
  const now = new Date().getTime();
  const deadlineTime = new Date(deadline).getTime();
  const diff = deadlineTime - now;

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, totalMinutes: 0, isExpired: true };
  }

  const totalMinutes = Math.floor(diff / (1000 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return { days, hours, minutes, totalMinutes, isExpired: false };
}

function getColorClass(totalMinutes: number, isExpired: boolean): string {
  if (isExpired) return 'text-gray-500';
  if (totalMinutes < 6 * 60) return 'text-red-400'; // < 6h
  if (totalMinutes < 24 * 60) return 'text-amber-400'; // < 24h
  return 'text-[#14F195]'; // > 24h (green)
}

function getBgClass(totalMinutes: number, isExpired: boolean): string {
  if (isExpired) return 'bg-gray-500/10';
  if (totalMinutes < 6 * 60) return 'bg-red-500/10';
  if (totalMinutes < 24 * 60) return 'bg-amber-500/10';
  return 'bg-[#14F195]/10';
}

export function CountdownTimer({ deadline, compact = false }: CountdownTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>(() =>
    calculateTimeRemaining(deadline)
  );

  useEffect(() => {
    // Update every minute
    const interval = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining(deadline));
    }, 60000);

    return () => clearInterval(interval);
  }, [deadline]);

  const colorClass = useMemo(
    () => getColorClass(timeRemaining.totalMinutes, timeRemaining.isExpired),
    [timeRemaining.totalMinutes, timeRemaining.isExpired]
  );

  const bgClass = useMemo(
    () => getBgClass(timeRemaining.totalMinutes, timeRemaining.isExpired),
    [timeRemaining.totalMinutes, timeRemaining.isExpired]
  );

  if (timeRemaining.isExpired) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium ${colorClass} ${bgClass}`}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Expired
      </span>
    );
  }

  const { days, hours, minutes } = timeRemaining;

  if (compact) {
    // Compact format: "2d 14h 32m"
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0 || days > 0) parts.push(`${hours}h`);
    parts.push(`${minutes}m`);

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium ${colorClass} ${bgClass}`}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {parts.join(' ')}
      </span>
    );
  }

  // Full format with labels
  return (
    <div className={`inline-flex items-center gap-3 px-3 py-2 rounded-lg ${bgClass}`}>
      <svg className={`w-5 h-5 ${colorClass}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <div className="flex items-center gap-2">
        {days > 0 && (
          <span className={colorClass}>
            <span className="text-xl font-bold">{days}</span>
            <span className="text-sm ml-1">days</span>
          </span>
        )}
        <span className={colorClass}>
          <span className="text-xl font-bold">{hours}</span>
          <span className="text-sm ml-1">hrs</span>
        </span>
        <span className={colorClass}>
          <span className="text-xl font-bold">{minutes}</span>
          <span className="text-sm ml-1">min</span>
        </span>
      </div>
    </div>
  );
}

export default CountdownTimer;