import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
  /** ISO deadline string. Renders nothing when absent. */
  deadline?: string | null;
  className?: string;
  /** Show the clock icon. Defaults to true. */
  showIcon?: boolean;
}

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Expired';
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${seconds}s`;
}

/**
 * Live-updating countdown to a bounty deadline.
 * - Ticks every second while under an hour remains, every 30s otherwise
 *   (cheap enough to render inside bounty card grids).
 * - Amber below 24h, red + pulse below 1h, "Expired" past the deadline.
 */
export function CountdownTimer({ deadline, className = '', showIcon = true }: CountdownTimerProps) {
  const [now, setNow] = useState(() => Date.now());

  const target = deadline ? new Date(deadline).getTime() : NaN;
  const valid = deadline != null && !Number.isNaN(target);

  useEffect(() => {
    if (!valid) return;
    const remaining = target - Date.now();
    // Tick fast when urgency is high, slow otherwise.
    const interval = remaining < HOUR_MS ? 1000 : 30_000;
    const id = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(id);
  }, [target, valid]);

  if (!valid) return null;

  const remaining = target - now;
  const expired = remaining <= 0;
  const urgent = !expired && remaining < HOUR_MS;
  const warning = !expired && !urgent && remaining < DAY_MS;

  const tone = expired
    ? 'text-text-muted'
    : urgent
      ? 'text-status-error animate-pulse'
      : warning
        ? 'text-status-warning'
        : '';

  const label = expired ? 'Expired' : formatRemaining(remaining);
  const ariaLabel = expired
    ? 'Bounty deadline has passed'
    : `Time remaining until bounty deadline: ${label}`;

  return (
    <span
      className={`inline-flex items-center gap-1 tabular-nums ${tone} ${className}`}
      aria-live={urgent ? 'polite' : 'off'}
      aria-label={ariaLabel}
      title={new Date(target).toLocaleString()}
    >
      {showIcon && <Clock className="w-3.5 h-3.5" aria-hidden />}
      {label}
    </span>
  );
}
