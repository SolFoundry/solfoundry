/**
 * CooldownTimer — live countdown to cooldown expiry.
 * Updates every second while mounted.
 */
import React, { useState, useEffect } from 'react';

interface CooldownTimerProps {
  endsAt: string;
  className?: string;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Ready to unstake';
  const totalSecs = Math.floor(ms / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  return `${mins}m ${secs}s`;
}

export function CooldownTimer({ endsAt, className = '' }: CooldownTimerProps) {
  const [remaining, setRemaining] = useState(() => new Date(endsAt).getTime() - Date.now());

  useEffect(() => {
    const tick = () => setRemaining(new Date(endsAt).getTime() - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  const ready = remaining <= 0;

  return (
    <div
      className={`flex items-center gap-2 ${className}`}
      role="timer"
      aria-label={ready ? 'Cooldown complete' : `Cooldown: ${formatRemaining(remaining)} remaining`}
    >
      <span className={`text-xs ${ready ? 'text-[#14F195]' : 'text-amber-400'}`}>
        {ready ? '✓' : '⏳'}
      </span>
      <span className={`font-mono text-sm ${ready ? 'text-[#14F195]' : 'text-amber-400'}`}>
        {formatRemaining(remaining)}
      </span>
    </div>
  );
}
