import React, { useEffect, useMemo, useState } from 'react';
import { Clock } from 'lucide-react';

interface BountyCountdownProps {
  deadline?: string | null;
  compact?: boolean;
}

interface CountdownState {
  label: string;
  tone: 'normal' | 'warning' | 'urgent' | 'expired';
}

function getCountdownState(deadline?: string | null): CountdownState | null {
  if (!deadline) return null;

  const target = new Date(deadline).getTime();
  const remainingMs = target - Date.now();

  if (!Number.isFinite(target)) {
    return { label: 'Unknown', tone: 'expired' };
  }

  if (remainingMs <= 0) {
    return { label: 'Expired', tone: 'expired' };
  }

  const totalMinutes = Math.ceil(remainingMs / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);

  return {
    label: parts.join(' '),
    tone: remainingMs < 3_600_000 ? 'urgent' : remainingMs < 86_400_000 ? 'warning' : 'normal',
  };
}

const toneClasses: Record<CountdownState['tone'], string> = {
  normal: 'text-text-muted border-border bg-forge-800/70',
  warning: 'text-status-warning border-status-warning/30 bg-status-warning/10',
  urgent: 'text-status-error border-status-error/30 bg-status-error/10',
  expired: 'text-text-muted border-border bg-forge-800/50',
};

export function BountyCountdown({ deadline, compact = false }: BountyCountdownProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!deadline) return undefined;

    const interval = window.setInterval(() => {
      setTick((value) => value + 1);
    }, 60_000);

    return () => window.clearInterval(interval);
  }, [deadline]);

  const countdown = useMemo(() => getCountdownState(deadline), [deadline, tick]);
  if (!countdown) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border font-mono ${
        compact ? 'px-1.5 py-0.5 text-xs' : 'px-2.5 py-1.5 text-sm'
      } ${toneClasses[countdown.tone]}`}
      aria-label={`Bounty deadline countdown: ${countdown.label}`}
      data-testid="bounty-countdown"
      data-urgency={countdown.tone}
    >
      <Clock className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
      {countdown.label}
    </span>
  );
}
