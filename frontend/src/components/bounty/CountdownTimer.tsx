import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface CountdownTimerProps {
  deadline: string | Date;
  onComplete?: () => void;
  className?: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

function getTimeLeft(deadline: string | Date): TimeLeft {
  const target = new Date(deadline).getTime();
  const now = Date.now();
  const total = target - now;

  if (total <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
  }

  return {
    days: Math.floor(total / (1000 * 60 * 60 * 24)),
    hours: Math.floor((total / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((total / (1000 * 60)) % 60),
    seconds: Math.floor((total / 1000) % 60),
    total,
  };
}

function TimeUnit({ value, label, urgent }: { value: number; label: string; urgent: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <motion.span
        key={value}
        initial={{ y: -4, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={`font-mono text-lg font-bold tabular-nums ${
          urgent ? 'text-status-error' : 'text-emerald'
        }`}
      >
        {String(value).padStart(2, '0')}
      </motion.span>
      <span className="text-[10px] text-text-muted uppercase tracking-wider mt-0.5">
        {label}
      </span>
    </div>
  );
}

export function CountdownTimer({ deadline, onComplete, className = '' }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(getTimeLeft(deadline));

  useEffect(() => {
    const interval = setInterval(() => {
      const newTime = getTimeLeft(deadline);
      setTimeLeft(newTime);

      if (newTime.total <= 0) {
        clearInterval(interval);
        onComplete?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [deadline, onComplete]);

  const isUrgent = timeLeft.total > 0 && timeLeft.total < 24 * 60 * 60 * 1000;
  const isExpired = timeLeft.total <= 0;

  if (isExpired) {
    return (
      <div className={`inline-flex items-center gap-1 text-xs text-text-muted ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-text-muted" />
        Expired
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {timeLeft.days > 0 && <TimeUnit value={timeLeft.days} label="Days" urgent={isUrgent} />}
      <TimeUnit value={timeLeft.hours} label="Hrs" urgent={isUrgent} />
      <span className={`font-mono text-lg ${isUrgent ? 'text-status-error' : 'text-text-muted'}`}>:</span>
      <TimeUnit value={timeLeft.minutes} label="Min" urgent={isUrgent} />
      <span className={`font-mono text-lg ${isUrgent ? 'text-status-error' : 'text-text-muted'}`}>:</span>
      <TimeUnit value={timeLeft.seconds} label="Sec" urgent={isUrgent} />
    </div>
  );
}
