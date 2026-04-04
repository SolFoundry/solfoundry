import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface BountyCountdownProps {
  deadline: string | null | undefined;
  /** Compact mode shows just "3d 5h" without segments — used on bounty cards */
  compact?: boolean;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

function computeTimeLeft(deadline: string): TimeLeft {
  const now = Date.now();
  const deadlineMs = new Date(deadline).getTime();
  const diff = deadlineMs - now;

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0 };
  }

  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1_000);

  return { days, hours, minutes, seconds, totalMs: diff };
}

function urgencyLevel(totalMs: number): 'normal' | 'warning' | 'urgent' {
  if (totalMs <= 0) return 'urgent';
  const hours = totalMs / 3_600_000;
  if (hours < 1) return 'urgent';
  if (hours < 24) return 'warning';
  return 'normal';
}

function urgencyColors(level: 'normal' | 'warning' | 'urgent') {
  switch (level) {
    case 'warning':
      return { text: 'text-status-warning', dot: 'bg-status-warning', label: 'Warning — less than 24h' };
    case 'urgent':
      return { text: 'text-status-error', dot: 'bg-status-error', label: 'Urgent — less than 1h' };
    default:
      return { text: 'text-text-muted', dot: 'bg-text-muted', label: '' };
  }
}

export function BountyCountdown({ deadline, compact = false }: BountyCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);

  useEffect(() => {
    if (!deadline) {
      setTimeLeft(null);
      return;
    }

    // Update immediately, then every second
    setTimeLeft(computeTimeLeft(deadline));
    const interval = setInterval(() => {
      setTimeLeft(computeTimeLeft(deadline));
    }, 1_000);

    return () => clearInterval(interval);
  }, [deadline]);

  if (!deadline) return null;

  if (!timeLeft) return null;

  if (timeLeft.totalMs <= 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-status-error">
        <Clock className="w-3.5 h-3.5" />
        Expired
      </span>
    );
  }

  const level = urgencyLevel(timeLeft.totalMs);
  const colors = urgencyColors(level);

  if (compact) {
    // Compact: "3d 5h" style — used on bounty cards
    const parts: string[] = [];
    if (timeLeft.days > 0) parts.push(`${timeLeft.days}d`);
    if (timeLeft.hours > 0 || timeLeft.days > 0) parts.push(`${timeLeft.hours}h`);
    if (timeLeft.days === 0) parts.push(`${timeLeft.minutes}m`);

    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium ${colors.text}`} title={colors.label}>
        <Clock className="w-3.5 h-3.5" />
        {parts.join(' ') || `${timeLeft.minutes}m`}
      </span>
    );
  }

  // Full countdown with day/hour/min/second segments
  return (
    <div className="flex items-center gap-1" title={colors.label}>
      {timeLeft.days > 0 && (
        <span className={`font-mono text-sm font-semibold ${colors.text}`}>
          {timeLeft.days}
          <span className="text-[10px] font-normal ml-0.5">d</span>
        </span>
      )}
      {timeLeft.days > 0 && <span className={`text-xs ${colors.text}`}>:</span>}
      <span className={`font-mono text-sm font-semibold ${colors.text}`}>
        {String(timeLeft.hours).padStart(2, '0')}
        <span className="text-[10px] font-normal ml-0.5">h</span>
      </span>
      <span className={`text-xs ${colors.text}`}>:</span>
      <span className={`font-mono text-sm font-semibold ${colors.text}`}>
        {String(timeLeft.minutes).padStart(2, '0')}
        <span className="text-[10px] font-normal ml-0.5">m</span>
      </span>
      {timeLeft.days === 0 && (
        <>
          <span className={`text-xs ${colors.text}`}>:</span>
          <span className={`font-mono text-sm font-semibold ${colors.text}`}>
            {String(timeLeft.seconds).padStart(2, '0')}
            <span className="text-[10px] font-normal ml-0.5">s</span>
          </span>
        </>
      )}
    </div>
  );
}
