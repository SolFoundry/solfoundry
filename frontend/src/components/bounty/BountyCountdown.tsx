import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

export type CountdownUrgency = 'normal' | 'warning' | 'urgent' | 'expired';

export interface CountdownState {
  urgency: CountdownUrgency;
  label: string;
  isExpired: boolean;
  totalMinutes: number;
}

export function getCountdownState(deadline: string, now = Date.now()): CountdownState {
  const deadlineTime = new Date(deadline).getTime();

  if (Number.isNaN(deadlineTime)) {
    return {
      urgency: 'expired',
      label: 'Expired',
      isExpired: true,
      totalMinutes: 0,
    };
  }

  const remainingMs = deadlineTime - now;
  if (remainingMs <= 0) {
    return {
      urgency: 'expired',
      label: 'Expired',
      isExpired: true,
      totalMinutes: 0,
    };
  }

  const totalMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  let label: string;
  if (days > 0) {
    label = `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    label = `${hours}h ${minutes}m`;
  } else {
    label = `${minutes}m`;
  }

  const urgency: CountdownUrgency =
    remainingMs < 60 * 60 * 1000
      ? 'urgent'
      : remainingMs < 24 * 60 * 60 * 1000
        ? 'warning'
        : 'normal';

  return {
    urgency,
    label,
    isExpired: false,
    totalMinutes,
  };
}

interface BountyCountdownProps {
  deadline: string;
  compact?: boolean;
}

const urgencyStyles: Record<CountdownUrgency, string> = {
  normal: 'text-text-muted border-border bg-forge-800/60',
  warning: 'text-status-warning border-status-warning/30 bg-status-warning/10',
  urgent: 'text-status-error border-status-error/40 bg-status-error/10 animate-pulse',
  expired: 'text-text-muted border-border bg-forge-800/70',
};

export function BountyCountdown({ deadline, compact = false }: BountyCountdownProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [deadline]);

  const countdown = getCountdownState(deadline, now);

  return (
    <span
      aria-live="polite"
      data-urgency={countdown.urgency}
      title={`Deadline: ${new Date(deadline).toLocaleString()}`}
      className={`inline-flex items-center gap-1 rounded-full border font-mono font-medium ${urgencyStyles[countdown.urgency]} ${
        compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      }`}
    >
      <Clock className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      <span>{countdown.label}</span>
    </span>
  );
}
