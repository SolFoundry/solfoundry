import { useState, useEffect } from 'react';
import { Clock, TimerOff } from 'lucide-react';
import { motion } from 'framer-motion';

interface CountdownTimerProps {
  deadline: string | Date;
  onExpired?: () => void;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function calcTimeLeft(deadline: Date): TimeLeft | null {
  const diff = deadline.getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

function getUrgency(tl: TimeLeft | null): 'normal' | 'warning' | 'urgent' | 'expired' {
  if (!tl) return 'expired';
  const totalHours = tl.days * 24 + tl.hours;
  if (totalHours < 1) return 'urgent';
  if (totalHours < 24) return 'warning';
  return 'normal';
}

const urgencyConfig = {
  normal: { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  warning: { color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  urgent: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  expired: { color: 'text-gray-500', bg: 'bg-gray-500/10 border-gray-500/20' },
};

export function CountdownTimer({ deadline, onExpired, showIcon = true, size = 'md' }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(() => calcTimeLeft(new Date(deadline)));

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = calcTimeLeft(new Date(deadline));
      setTimeLeft(remaining);
      if (!remaining) {
        onExpired?.();
        clearInterval(timer);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [deadline, onExpired]);

  const urgency = getUrgency(timeLeft);
  const { color, bg } = urgencyConfig[urgency];
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-1 gap-1' : size === 'lg' ? 'text-base px-4 py-2 gap-2' : 'text-sm px-3 py-1.5 gap-1.5';

  if (!timeLeft) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`inline-flex items-center rounded-lg border ${bg} ${color} ${sizeClasses}`}>
        <TimerOff className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
        <span className="font-medium">Expired</span>
      </motion.div>
    );
  }

  const parts: { label: string; value: number }[] = [];
  if (timeLeft.days > 0) parts.push({ label: 'd', value: timeLeft.days });
  parts.push({ label: 'h', value: timeLeft.hours });
  parts.push({ label: 'm', value: timeLeft.minutes });
  if (timeLeft.days === 0) parts.push({ label: 's', value: timeLeft.seconds });

  return (
    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className={`inline-flex items-center rounded-lg border ${bg} ${color} ${sizeClasses}`}>
      {showIcon && <Clock className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />}
      {parts.map((part, i) => (
        <span key={part.label} className="font-mono font-semibold">
          {String(part.value).padStart(2, '0')}{part.label}
          {i < parts.length - 1 ? <span className="mx-0.5 opacity-50">:</span> : null}
        </span>
      ))}
    </motion.div>
  );
}
