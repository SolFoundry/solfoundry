import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
  deadline: string;
  className?: string;
}

function calc(deadline: string) {
  const diff = new Date(deadline).getTime() - Date.now();
  return { total: Math.max(0, diff) };
}

export function CountdownTimer({ deadline, className = '' }: CountdownTimerProps) {
  const [tl, setTl] = useState(() => calc(deadline));

  useEffect(() => {
    const id = setInterval(() => setTl(calc(deadline)), 1000);
    return () => clearInterval(id);
  }, [deadline]);

  const expired = tl.total <= 0;
  const hrs = tl.total / (1000 * 60 * 60);

  let color = 'text-text-muted';
  if (expired) color = 'text-red-500';
  else if (hrs < 1) color = 'text-red-400';
  else if (hrs < 24) color = 'text-amber-400';

  if (expired) {
    return (
      <span className={`inline-flex items-center gap-1 font-mono text-xs ${color} ${className}`}>
        <Clock className="w-3.5 h-3.5" />
        Expired
      </span>
    );
  }

  const d = Math.floor(tl.total / 86400000);
  const h = Math.floor((tl.total % 86400000) / 3600000);
  const m = Math.floor((tl.total % 3600000) / 60000);
  const s = Math.floor((tl.total % 60000) / 1000);

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <span className={`inline-flex items-center gap-1 font-mono text-xs ${color} ${className}`}>
      <Clock className="w-3.5 h-3.5" />
      {d > 0 ? `${d}d ` : ''}{pad(h)}:{pad(m)}:{pad(s)}
    </span>
  );
}
