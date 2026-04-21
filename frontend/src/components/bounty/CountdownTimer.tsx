import { useEffect, useMemo, useState } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '../../lib/utils';

type CountdownTone = 'normal' | 'warning' | 'urgent' | 'expired';

interface CountdownTimerProps {
  deadline: string;
  size?: 'sm' | 'md';
  showIcon?: boolean;
  className?: string;
}

function getRemaining(deadline: string) {
  const target = new Date(deadline).getTime();
  const remainingMs = Number.isFinite(target) ? target - Date.now() : 0;
  const totalMinutes = Math.max(0, Math.floor(remainingMs / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  let tone: CountdownTone = 'normal';

  if (remainingMs <= 0) tone = 'expired';
  else if (remainingMs < 60 * 60 * 1000) tone = 'urgent';
  else if (remainingMs < 24 * 60 * 60 * 1000) tone = 'warning';

  return { days, hours, minutes, tone };
}

function formatRemaining(parts: ReturnType<typeof getRemaining>) {
  if (parts.tone === 'expired') return 'Expired';
  if (parts.days > 0) return `${parts.days}d ${parts.hours}h ${parts.minutes}m`;
  if (parts.hours > 0) return `${parts.hours}h ${parts.minutes}m`;

  return `${Math.max(1, parts.minutes)}m`;
}

export function CountdownTimer({ deadline, size = 'sm', showIcon = true, className }: CountdownTimerProps) {
  const [now, setNow] = useState(() => Date.now());
  const remaining = useMemo(() => getRemaining(deadline), [deadline, now]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(interval);
  }, []);

  const toneClass: Record<CountdownTone, string> = {
    normal: 'text-text-muted border-border bg-forge-850',
    warning: 'text-status-warning border-status-warning/30 bg-status-warning/10',
    urgent: 'text-status-error border-status-error/30 bg-status-error/10',
    expired: 'text-text-muted border-border bg-forge-800',
  };

  return (
    <span
      role="timer"
      aria-live="polite"
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-mono font-medium',
        size === 'md' ? 'px-2.5 py-1 text-sm' : 'px-2 py-0.5 text-xs',
        toneClass[remaining.tone],
        className,
      )}
    >
      {showIcon && <Clock className={size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5'} />}
      {formatRemaining(remaining)}
    </span>
  );
}
