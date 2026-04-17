import { useState, useEffect, useCallback } from 'react';

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  isExpired: boolean;
  isUrgent: boolean;   // < 1 hour
  isWarning: boolean;  // < 24 hours
}

/**
 * React hook that returns a live countdown toward `deadline` (ISO string).
 * Updates every second while the deadline is still in the future.
 */
export function useCountdown(deadline: string | null | undefined): CountdownParts {
  const compute = useCallback((): CountdownParts => {
    const totalMs = deadline ? new Date(deadline).getTime() - Date.now() : 0;
    const isExpired = totalMs <= 0;
    const safeMs = Math.max(totalMs, 0);

    return {
      days: Math.floor(safeMs / (1000 * 60 * 60 * 24)),
      hours: Math.floor((safeMs / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((safeMs / (1000 * 60)) % 60),
      seconds: Math.floor((safeMs / 1000) % 60),
      totalMs: safeMs,
      isExpired,
      isUrgent: !isExpired && safeMs < 1000 * 60 * 60,
      isWarning: !isExpired && safeMs < 1000 * 60 * 60 * 24,
    };
  }, [deadline]);

  const [parts, setParts] = useState<CountdownParts>(compute);

  useEffect(() => {
    // No deadline → return expired state and don't start interval
    if (!deadline) return;

    const id = setInterval(() => setParts(compute()), 1000);
    return () => clearInterval(id);
  }, [deadline, compute]);

  return parts;
}
