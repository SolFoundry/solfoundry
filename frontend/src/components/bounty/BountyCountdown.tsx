import React, { useEffect, useMemo, useState } from 'react';

function formatRemaining(target: number): { text: string; urgent: boolean; warning: boolean; expired: boolean } {
  const now = Date.now();
  const diff = target - now;
  if (diff <= 0) return { text: 'Expired', urgent: false, warning: false, expired: true };

  const totalMin = Math.floor(diff / 60000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;

  if (days > 0) return { text: `${days}d ${hours}h ${mins}m`, urgent: false, warning: false, expired: false };
  return {
    text: `${hours}h ${mins}m`,
    urgent: diff < 60 * 60 * 1000,
    warning: diff < 24 * 60 * 60 * 1000,
    expired: false,
  };
}

export function BountyCountdown({ deadline, className = '' }: { deadline: string; className?: string }) {
  const target = useMemo(() => new Date(deadline).getTime(), [deadline]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((v) => v + 1), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const remaining = formatRemaining(target + tick * 0);
  const tone = remaining.expired
    ? 'text-status-error'
    : remaining.urgent
      ? 'text-status-error'
      : remaining.warning
        ? 'text-status-warning'
        : 'text-text-muted';

  return <span className={`${tone} ${className}`}>{remaining.text}</span>;
}
