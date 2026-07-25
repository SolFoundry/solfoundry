import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, AlertTriangle, Timer } from 'lucide-react';
import { getCountdownValues } from '../../lib/utils';

interface BountyCountdownTimerProps {
  deadline: string;
  size?: 'sm' | 'md' | 'lg';
}

const URGENCY_THRESHOLD_HOURS = 24; // yellow/warning
const CRITICAL_THRESHOLD_HOURS = 1; // red/urgent

function useCountdown(deadline: string) {
  const [values, setValues] = useState(() => getCountdownValues(deadline));

  useEffect(() => {
    // Update immediately on mount
    setValues(getCountdownValues(deadline));

    const interval = setInterval(() => {
      setValues(getCountdownValues(deadline));
    }, 1000);

    return () => clearInterval(interval);
  }, [deadline]);

  return values;
}

function getUrgencyLevel(deadline: string): 'normal' | 'warning' | 'urgent' | 'expired' {
  const now = Date.now();
  const deadlineMs = new Date(deadline).getTime();
  const diffMs = deadlineMs - now;

  if (diffMs <= 0) return 'expired';
  const hoursLeft = diffMs / (1000 * 60 * 60);
  if (hoursLeft < CRITICAL_THRESHOLD_HOURS) return 'urgent';
  if (hoursLeft < URGENCY_THRESHOLD_HOURS) return 'warning';
  return 'normal';
}

function formatTimeUnit(value: number): string {
  return value.toString().padStart(2, '0');
}

export function BountyCountdownTimer({ deadline, size = 'sm' }: BountyCountdownTimerProps) {
  const values = useCountdown(deadline);
  const urgency = getUrgencyLevel(deadline);

  const unitSize = size === 'lg' ? 'text-lg' : size === 'md' ? 'text-sm' : 'text-xs';

  const urgencyConfig = {
    normal: {
      bg: 'bg-emerald-bg',
      border: 'border-emerald-border',
      text: 'text-emerald',
      icon: Clock,
      label: 'Time Remaining',
    },
    warning: {
      bg: 'bg-status-warning/10',
      border: 'border-status-warning/30',
      text: 'text-status-warning',
      icon: AlertTriangle,
      label: 'Ending Soon',
    },
    urgent: {
      bg: 'bg-status-error/10',
      border: 'border-status-error/30',
      text: 'text-status-error',
      icon: Timer,
      label: 'Ending Very Soon',
    },
    expired: {
      bg: 'bg-forge-800',
      border: 'border-border',
      text: 'text-text-muted',
      icon: Clock,
      label: 'Expired',
    },
  };

  const config = urgencyConfig[urgency];
  const IconComponent = config.icon;

  if (values.expired) {
    return (
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`inline-flex items-center gap-1 ${unitSize} text-text-muted`}
      >
        <Clock className={`${size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5'}`} />
        Expired
      </motion.span>
    );
  }

  // For small variant (card use), show compact format
  if (size === 'sm') {
    const label = values.days > 0
      ? `${values.days}d ${values.hours}h`
      : values.hours > 0
        ? `${values.hours}h ${values.minutes}m`
        : `${values.minutes}m ${values.seconds}s`;

    return (
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`inline-flex items-center gap-1 ${unitSize} ${config.text} transition-colors duration-500`}
      >
        <IconComponent className="w-3.5 h-3.5" />
        {label}
        {urgency === 'urgent' && (
          <motion.span
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-1.5 h-1.5 rounded-full bg-status-error ml-0.5"
          />
        )}
      </motion.span>
    );
  }

  // For detail page (lg), show full countdown
  const segments = [
    { label: 'Days', value: values.days },
    { label: 'Hours', value: values.hours },
    { label: 'Mins', value: values.minutes },
    { label: 'Secs', value: values.seconds },
  ];

  return (
    <div className={`rounded-xl border ${config.border} ${config.bg} p-5`}>
      <div className="flex items-center gap-2 mb-3">
        <IconComponent className={`w-4 h-4 ${config.text}`} />
        <span className={`text-xs font-medium ${config.text}`}>{config.label}</span>
        {urgency === 'urgent' && (
          <motion.span
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-2 h-2 rounded-full bg-status-error"
          />
        )}
      </div>
      <div className="grid grid-cols-4 gap-2">
        <AnimatePresence mode="popLayout">
          {segments.map((seg) => (
            <motion.div
              key={seg.label}
              layout
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="text-center"
            >
              <div className={`font-mono text-2xl font-bold ${config.text}`}>
                {formatTimeUnit(seg.value)}
              </div>
              <div className="text-[10px] text-text-muted mt-0.5 uppercase tracking-wider">
                {seg.label}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}