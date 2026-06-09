import { useState, useEffect } from 'react';

interface CountdownTimerProps {
  deadline: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function calcTimeLeft(deadline: string): TimeLeft | null {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

function urgencyLevel(tl: TimeLeft | null): 'expired' | 'urgent' | 'warning' | 'normal' {
  if (!tl) return 'expired';
  const totalHours = tl.days * 24 + tl.hours;
  if (totalHours < 1) return 'urgent';
  if (totalHours < 24) return 'warning';
  return 'normal';
}

const STYLES = {
  expired: {
    container: 'bg-status-error/10 border border-status-error/20',
    text: 'text-status-error',
    label: 'Expired',
  },
  urgent: {
    container: 'bg-red-500/15 border border-red-500/30 animate-pulse',
    text: 'text-red-400',
    label: 'Urgent',
  },
  warning: {
    container: 'bg-amber-500/10 border border-amber-500/20',
    text: 'text-amber-400',
    label: 'Warning',
  },
  normal: {
    container: 'bg-border/20 border border-border/30',
    text: 'text-text-muted',
    label: 'Open',
  },
};

export function BountyCountdownTimer({ deadline }: CountdownTimerProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tl = calcTimeLeft(deadline);
  const urgency = urgencyLevel(tl);
  const style = STYLES[urgency];

  if (urgency === 'expired') {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${style.container}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-status-error" />
        <span className={style.text}>Expired</span>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${style.container}`}>
      <svg className={`w-3.5 h-3.5 ${style.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className={`font-mono text-xs font-semibold tabular-nums ${style.text}`}>
        {tl!.days}d {tl!.hours.toString().padStart(2, '0')}h {tl!.minutes.toString().padStart(2, '0')}m {tl!.seconds.toString().padStart(2, '0')}s
      </span>
      {urgency !== 'normal' && (
        <span className={`text-[10px] font-medium uppercase tracking-wider ${style.text}`}>
          {style.label}
        </span>
      )}
    </div>
  );
}
