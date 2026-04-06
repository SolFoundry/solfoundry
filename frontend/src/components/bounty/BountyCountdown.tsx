import React, { useEffect, useMemo, useState } from 'react';
import { Clock } from 'lucide-react';

interface CountdownState {
  expired: boolean;
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
}

function getCountdownState(deadline: string): CountdownState {
  const totalMs = new Date(deadline).getTime() - Date.now();

  if (Number.isNaN(totalMs) || totalMs <= 0) {
    return { expired: true, totalMs: 0, days: 0, hours: 0, minutes: 0 };
  }

  const totalMinutes = Math.floor(totalMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  return { expired: false, totalMs, days, hours, minutes };
}

function getToneClass(state: CountdownState) {
  if (state.expired) return 'text-status-error';
  if (state.totalMs < 60 * 60 * 1000) return 'text-status-error';
  if (state.totalMs < 24 * 60 * 60 * 1000) return 'text-status-warning';
  return 'text-text-muted';
}

export function BountyCountdown({ deadline, compact = false }: { deadline: string; compact?: boolean }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const state = useMemo(() => {
    void now;
    return getCountdownState(deadline);
  }, [deadline, now]);

  const label = state.expired ? 'Expired' : `${state.days}d ${state.hours}h ${state.minutes}m`;

  return (
    <span className={`inline-flex items-center gap-1 ${getToneClass(state)}`} aria-label={`Time remaining: ${label}`}>
      <Clock className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
      <span className="font-mono">{label}</span>
    </span>
  );
}
