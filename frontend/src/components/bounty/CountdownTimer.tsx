import React, { useEffect, useMemo, useState } from 'react';
import { Clock } from 'lucide-react';
import { formatTimeRemaining } from '../../lib/utils';

interface CountdownTimerProps {
  deadline?: string | null;
  className?: string;
  showIcon?: boolean;
}

function getTimerTone(deadline: string | null | undefined, now: number) {
  if (!deadline) {
    return {
      textClass: 'text-text-muted',
      badgeClass: 'bg-forge-800 text-text-muted border-border',
      testId: 'timer-missing',
    };
  }

  const remainingMs = new Date(deadline).getTime() - now;
  if (Number.isNaN(remainingMs) || remainingMs <= 0) {
    return {
      textClass: 'text-status-error',
      badgeClass: 'bg-status-error/10 text-status-error border-status-error/20',
      testId: 'expired-indicator',
    };
  }

  if (remainingMs < 60 * 60 * 1000) {
    return {
      textClass: 'text-status-error',
      badgeClass: 'bg-status-error/10 text-status-error border-status-error/20 animate-pulse-glow',
      testId: 'urgent-indicator',
    };
  }

  if (remainingMs < 24 * 60 * 60 * 1000) {
    return {
      textClass: 'text-status-warning',
      badgeClass: 'bg-status-warning/10 text-status-warning border-status-warning/20',
      testId: 'warning-indicator',
    };
  }

  return {
    textClass: 'text-text-muted',
    badgeClass: 'bg-forge-800 text-text-muted border-border',
    testId: 'timer-normal',
  };
}

export function CountdownTimer({ deadline, className = '', showIcon = true }: CountdownTimerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!deadline) return;

    setNow(Date.now());
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [deadline]);

  const tone = useMemo(() => getTimerTone(deadline, now), [deadline, now]);

  if (!deadline) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-mono ${tone.textClass} ${className}`.trim()}>
        {showIcon && <Clock className="w-3.5 h-3.5" />}
        No deadline
      </span>
    );
  }

  const label = formatTimeRemaining(deadline, now);

  return (
    <span
      data-testid={tone.testId}
      title={new Date(deadline).toLocaleString()}
      className={[
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-mono font-medium',
        tone.badgeClass,
        className,
      ].join(' ').trim()}
    >
      {showIcon && <Clock className="w-3.5 h-3.5" />}
      <span>{label}</span>
    </span>
  );
}
