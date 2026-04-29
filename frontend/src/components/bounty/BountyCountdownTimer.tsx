import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';

interface BountyCountdownTimerProps {
  deadline: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
  expired: boolean;
}

/**
 * Calculate time remaining until deadline
 */
function calculateTimeRemaining(deadline: string): TimeRemaining {
  const now = new Date().getTime();
  const end = new Date(deadline).getTime();
  const diff = end - now;

  if (diff <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      total: 0,
      expired: true,
    };
  }

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
    total: diff,
    expired: false,
  };
}

/**
 * Get urgency level based on time remaining
 */
function getUrgencyLevel(time: TimeRemaining): 'urgent' | 'warning' | 'normal' {
  if (time.expired || time.total < 1000 * 60 * 60) return 'urgent'; // < 1 hour
  if (time.total < 1000 * 60 * 60 * 24) return 'warning'; // < 24 hours
  return 'normal';
}

/**
 * Bounty Countdown Timer Component
 * 
 * Shows time remaining until bounty deadline with real-time updates.
 * Changes color when < 24 hours (warning) and < 1 hour (urgent).
 */
export function BountyCountdownTimer({
  deadline,
  showIcon = true,
  size = 'md',
  className = '',
}: BountyCountdownTimerProps) {
  const [time, setTime] = useState<TimeRemaining>(() => calculateTimeRemaining(deadline));

  // Update every second
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(calculateTimeRemaining(deadline));
    }, 1000);

    return () => clearInterval(timer);
  }, [deadline]);

  const urgency = useMemo(() => getUrgencyLevel(time), [time]);

  // Size classes
  const sizeClasses = {
    sm: 'text-xs gap-1',
    md: 'text-sm gap-1.5',
    lg: 'text-base gap-2',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  // Urgency colors
  const urgencyColors = {
    normal: 'text-text-muted',
    warning: 'text-amber-400',
    urgent: 'text-red-400 animate-pulse',
  };

  // Format display
  let display: string;
  if (time.expired) {
    display = 'Expired';
  } else if (time.days > 0) {
    display = `${time.days}d ${time.hours}h ${time.minutes}m`;
  } else if (time.hours > 0) {
    display = `${time.hours}h ${time.minutes}m ${time.seconds}s`;
  } else if (time.minutes > 0) {
    display = `${time.minutes}m ${time.seconds}s`;
  } else {
    display = `${time.seconds}s`;
  }

  return (
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`inline-flex items-center ${sizeClasses[size]} ${urgencyColors[urgency]} ${className}`}
    >
      {showIcon && <Clock className={iconSizes[size]} />}
      <span className="font-mono font-medium">{display}</span>
    </motion.span>
  );
}

/**
 * Detailed Countdown Display (for bounty detail page)
 * Shows days, hours, minutes, seconds in separate blocks
 */
export function BountyCountdownDetailed({
  deadline,
  className = '',
}: {
  deadline: string;
  className?: string;
}) {
  const [time, setTime] = useState<TimeRemaining>(() => calculateTimeRemaining(deadline));

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(calculateTimeRemaining(deadline));
    }, 1000);

    return () => clearInterval(timer);
  }, [deadline]);

  const urgency = getUrgencyLevel(time);

  const blockColors = {
    normal: 'bg-forge-800 border-border',
    warning: 'bg-amber-500/10 border-amber-500/30',
    urgent: 'bg-red-500/10 border-red-500/30',
  };

  const textColors = {
    normal: 'text-text-primary',
    warning: 'text-amber-400',
    urgent: 'text-red-400',
  };

  if (time.expired) {
    return (
      <div className={`rounded-lg border ${blockColors.urgent} p-4 text-center ${className}`}>
        <span className={`text-lg font-semibold ${textColors.urgent}`}>Bounty Expired</span>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-4 gap-2 ${className}`}>
      <TimeBlock value={time.days} label="Days" urgency={urgency} colors={blockColors} textColors={textColors} />
      <TimeBlock value={time.hours} label="Hours" urgency={urgency} colors={blockColors} textColors={textColors} />
      <TimeBlock value={time.minutes} label="Min" urgency={urgency} colors={blockColors} textColors={textColors} />
      <TimeBlock value={time.seconds} label="Sec" urgency={urgency} colors={blockColors} textColors={textColors} />
    </div>
  );
}

function TimeBlock({
  value,
  label,
  urgency,
  colors,
  textColors,
}: {
  value: number;
  label: string;
  urgency: 'urgent' | 'warning' | 'normal';
  colors: Record<string, string>;
  textColors: Record<string, string>;
}) {
  return (
    <div className={`rounded-lg border ${colors[urgency]} p-2 text-center`}>
      <span className={`text-2xl font-mono font-bold ${textColors[urgency]}`}>
        {String(value).padStart(2, '0')}
      </span>
      <span className="block text-xs text-text-muted mt-1">{label}</span>
    </div>
  );
}

export default BountyCountdownTimer;
