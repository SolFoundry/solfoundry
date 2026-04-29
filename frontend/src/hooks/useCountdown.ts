/**
 * useCountdown — Custom React hook for countdown timer logic.
 *
 * Returns the remaining time breakdown (days, hours, minutes, seconds)
 * and a urgency level based on how close the deadline is.
 *
 * Usage:
 *   const { days, hours, minutes, seconds, urgency, isExpired } =
 *     useCountdown('2026-05-01T00:00:00Z');
 */

import { useState, useEffect } from 'react';

/**
 * Urgency levels for the countdown display.
 * - 'normal'    : more than 24 hours remaining
 * - 'warning'   : less than 24 hours remaining
 * - 'urgent'    : less than 1 hour remaining
 * - 'expired'   : deadline has passed
 */
export type UrgencyLevel = 'normal' | 'warning' | 'urgent' | 'expired';

export interface CountdownState {
  /** Whether the deadline has passed */
  isExpired: boolean;
  /** Remaining days */
  days: number;
  /** Remaining hours (0-23) */
  hours: number;
  /** Remaining minutes (0-59) */
  minutes: number;
  /** Remaining seconds (0-59) */
  seconds: number;
  /** Total remaining seconds (not broken down) */
  totalSeconds: number;
  /** Urgency level for styling */
  urgency: UrgencyLevel;
}

/**
 * Computes the remaining time from a deadline ISO string.
 */
function computeCountdown(deadline: string): CountdownState {
  const now = Date.now();
  const deadlineMs = new Date(deadline).getTime();
  const diffMs = deadlineMs - now;
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));

  if (diffMs <= 0) {
    return {
      isExpired: true,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalSeconds: 0,
      urgency: 'expired',
    };
  }

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // Determine urgency based on total remaining time
  const remainingHours = days * 24 + hours;
  let urgency: UrgencyLevel = 'normal';
  if (remainingHours < 1) {
    urgency = 'urgent';
  } else if (remainingHours < 24) {
    urgency = 'warning';
  }

  return {
    isExpired: false,
    days,
    hours,
    minutes,
    seconds,
    totalSeconds,
    urgency,
  };
}

/**
 * useCountdown hook — updates every second.
 *
 * @param deadline - ISO 8601 deadline string (e.g. '2026-05-01T00:00:00Z')
 * @param intervalMs - Update interval in ms (default: 1000)
 */
export function useCountdown(
  deadline: string | null | undefined,
  intervalMs: number = 1000,
): CountdownState {
  // If no deadline provided, treat as expired
  if (!deadline) {
    return computeCountdown(new Date(0).toISOString());
  }

  const [state, setState] = useState<CountdownState>(() =>
    computeCountdown(deadline),
  );

  useEffect(() => {
    // Recalculate on deadline change
    setState(computeCountdown(deadline!));
  }, [deadline]);

  useEffect(() => {
    const timer = setInterval(() => {
      setState((prev) => {
        // If already expired, stop updating
        if (prev.isExpired) return prev;
        return computeCountdown(deadline!);
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [deadline, intervalMs]);

  return state;
}
