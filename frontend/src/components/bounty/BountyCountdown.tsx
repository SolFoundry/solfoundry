import React, { useEffect, useMemo, useState } from 'react';
import { Clock } from 'lucide-react';

function formatTimeLeft(deadline: string): { text: string; expired: boolean; urgency: 'normal' | 'warning' | 'urgent' } {
  const target = new Date(deadline).getTime();
  const diff = target - Date.now();

  if (!Number.isFinite(target) || diff <= 0) {
    return { text: 'Expired', expired: true, urgency: 'urgent' };
  }

  const totalMinutes = Math.floor(diff / 1000 / 60);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const text = `${days}d ${hours}h ${minutes}m`;
  if (diff < 60 * 60 * 1000) return { text, expired: false, urgency: 'urgent' };
  if (diff < 24 * 60 * 60 * 1000) return { text, expired: false, urgency: 'warning' };
  return { text, expired: false, urgency: 'normal' };
}

interface BountyCountdownProps {
  deadline: string;
  className?: string;
}

export function BountyCountdown({ deadline, className = '' }: BountyCountdownProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((v) => v + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const state = useMemo(() => formatTimeLeft(deadline), [deadline]);

  const colorClass = state.expired
    ? 'text-status-error'
    : state.urgency === 'urgent'
      ? 'text-status-error'
      : state.urgency === 'warning'
        ? 'text-status-warning'
        : 'text-text-muted';

  return (
    <span className={`inline-flex items-center gap-1 ${colorClass} ${className}`.trim()}>
      <Clock className="w-3.5 h-3.5" />
      {state.text}
    </span>
  );
}
