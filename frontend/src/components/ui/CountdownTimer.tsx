import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
  deadline: string | Date;
  onExpire?: () => void;
  className?: string;
}

export function CountdownTimer({ deadline, onExpire, className = '' }: CountdownTimerProps) {
  const deadlineDate = typeof deadline === 'string' ? new Date(deadline) : deadline;
  const [now, setNow] = useState(Date.now());
  const diff = deadlineDate.getTime() - now;
  const expired = diff <= 0;
  const urgent = !expired && diff < 3600000;
  const warning = !expired && diff < 86400000;
  const d = Math.max(0, Math.floor(diff / 86400000));
  const h = Math.max(0, Math.floor((diff % 86400000) / 3600000));
  const m = Math.max(0, Math.floor((diff % 3600000) / 60000));
  const s = Math.max(0, Math.floor((diff % 60000) / 1000));

  useEffect(() => {
    if (expired) { onExpire?.(); return; }
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [diff, expired, onExpire]);

  if (expired) return (
    <div className="flex items-center gap-1.5 text-xs text-red-400 bg-red-950/50 border border-red-800/50 rounded-md px-2.5 py-1">
      <Clock className="w-3.5 h-3.5" /><span className="font-semibold">Expired</span>
    </div>
  );

  const cc = urgent ? 'text-red-400 bg-red-950/50 border-red-800/50' : warning ? 'text-amber-400 bg-amber-950/50 border-amber-800/50' : 'text-emerald-400 bg-emerald-950/50 border-emerald-800/50';
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className={`flex items-center gap-1 ${cc} border rounded-md px-2.5 py-1 ${className}`}>
      <Clock className="w-3.5 h-3.5 shrink-0" />
      <div className="flex items-center gap-1 text-xs font-mono tabular-nums">
        {d > 0 && <>{pad(d)}<span className="text-gray-500">d</span> </>}
        {pad(h)}<span className="text-gray-500">:</span>
        {pad(m)}<span className="text-gray-500">:</span>
        {pad(s)}
      </div>
    </div>
  );
}
