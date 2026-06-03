import { useState, useEffect } from 'react';
import { Clock, AlertTriangle, Zap } from 'lucide-react';

interface BountyCountdownTimerProps {
  deadline: string;
  compact?: boolean;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  expired: boolean;
}

function calcTimeRemaining(deadline: string): TimeRemaining {
  const end = new Date(deadline).getTime();
  const now = Date.now();
  const totalMs = end - now;

  if (totalMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, expired: true };
  }

  const days = Math.floor(totalMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((totalMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((totalMs % (1000 * 60)) / 1000);

  return { days, hours, minutes, seconds, totalMs, expired: false };
}

function formatCompact(t: TimeRemaining): string {
  if (t.expired) return 'Expired';
  if (t.days > 0) return `${t.days}d ${t.hours}h`;
  if (t.hours > 0) return `${t.hours}h ${t.minutes}m`;
  if (t.minutes > 0) return `${t.minutes}m ${t.seconds}s`;
  return `${t.seconds}s`;
}

function formatFull(t: TimeRemaining): string {
  if (t.expired) return 'Expired';
  const parts: string[] = [];
  if (t.days > 0) parts.push(`${t.days}d`);
  if (t.hours > 0) parts.push(`${t.hours}h`);
  if (t.minutes > 0) parts.push(`${t.minutes}m`);
  parts.push(`${t.seconds}s`);
  return parts.join(' ');
}

// Urgency thresholds
const URGENT_MS = 1000 * 60 * 60;        // < 1 hour
const WARNING_MS = 1000 * 60 * 60 * 24;  // < 24 hours

export function BountyCountdownTimer({ deadline, compact = false }: BountyCountdownTimerProps) {
  const [time, setTime] = useState<TimeRemaining>(() => calcTimeRemaining(deadline));

  useEffect(() => {
    if (time.expired) return;
    const id = setInterval(() => {
      const next = calcTimeRemaining(deadline);
      setTime(next);
      if (next.expired) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  const isUrgent = !time.expired && time.totalMs < URGENT_MS;
  const isWarning = !time.expired && time.totalMs < WARNING_MS && !isUrgent;

  // Color scheme
  let textColor = 'text-text-muted';
  let bgColor = '';
  let icon = <Clock className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />;

  if (time.expired) {
    textColor = 'text-status-error';
    icon = <Clock className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />;
  } else if (isUrgent) {
    textColor = 'text-red-400 font-semibold';
    bgColor = 'bg-red-500/10 px-2 py-0.5 rounded';
    icon = <Zap className={compact ? 'w-3.5 h-3.5 animate-pulse' : 'w-4 h-4 animate-pulse'} />;
  } else if (isWarning) {
    textColor = 'text-amber-400';
    bgColor = 'bg-amber-500/10 px-2 py-0.5 rounded';
    icon = <AlertTriangle className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 ${textColor} ${bgColor} transition-colors duration-300`}>
      {icon}
      {compact ? formatCompact(time) : formatFull(time)}
    </span>
  );
}
