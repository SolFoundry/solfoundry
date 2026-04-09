import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Clock, AlertCircle, Hourglass } from 'lucide-react';
import { getTimeRemaining, isUrgent, isCritical } from '../../lib/utils';

interface CountdownTimerProps {
  deadline: string | Date;
  createdAt?: string | Date;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
  onExpire?: () => void;
  variant?: 'default' | 'compact' | 'detailed' | 'with-progress';
}

interface TimeUnitProps {
  value: number;
  label: string;
  size: 'sm' | 'md' | 'lg';
  isUrgent?: boolean;
  isCritical?: boolean;
}

function TimeUnit({ value, label, size, isUrgent, isCritical }: TimeUnitProps) {
  const sizeClasses = {
    sm: {
      container: 'min-w-[28px] px-1 py-0.5',
      value: 'text-xs',
      label: 'text-[8px]',
    },
    md: {
      container: 'min-w-[44px] px-2 py-1',
      value: 'text-sm',
      label: 'text-[10px]',
    },
    lg: {
      container: 'min-w-[64px] px-3 py-2',
      value: 'text-2xl',
      label: 'text-xs',
    },
  };

  const colorClasses = isCritical
    ? 'bg-status-error/10 border-status-error/30 text-status-error'
    : isUrgent
    ? 'bg-status-warning/10 border-status-warning/30 text-status-warning'
    : 'bg-forge-800 border-border text-text-primary';

  return (
    <div className={`flex flex-col items-center rounded-lg border ${sizeClasses[size].container} ${colorClasses}`}>
      <span className={`font-mono font-bold ${sizeClasses[size].value}`}>
        {value.toString().padStart(2, '0')}
      </span>
      <span className={`text-text-muted uppercase tracking-wider ${sizeClasses[size].label}`}>
        {label}
      </span>
    </div>
  );
}

export function CountdownTimer({
  deadline,
  createdAt,
  size = 'md',
  showIcon = true,
  className = '',
  onExpire,
  variant = 'default',
}: CountdownTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(() => getTimeRemaining(deadline));
  const [hasExpired, setHasExpired] = useState(false);

  const updateTimer = useCallback(() => {
    const remaining = getTimeRemaining(deadline);
    setTimeRemaining(remaining);

    if (remaining.isExpired && !hasExpired) {
      setHasExpired(true);
      onExpire?.();
    }
  }, [deadline, hasExpired, onExpire]);

  useEffect(() => {
    // Initial update
    updateTimer();

    // Set up interval for real-time updates
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [updateTimer]);

  // Handle timezone changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateTimer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [updateTimer]);

  if (timeRemaining.isExpired) {
    return (
      <div className={`inline-flex items-center gap-2 text-status-error ${className}`}>
        {showIcon && <AlertCircle className="w-4 h-4" />}
        <span className="font-medium">Expired</span>
      </div>
    );
  }

  const urgent = isUrgent(deadline);
  const critical = isCritical(deadline);

  // Compact variant - just shows days/hours or hours/minutes
  if (variant === 'compact') {
    const timeString = timeRemaining.days > 0
      ? `${timeRemaining.days}d ${timeRemaining.hours}h`
      : timeRemaining.hours > 0
      ? `${timeRemaining.hours}h ${timeRemaining.minutes}m`
      : `${timeRemaining.minutes}m ${timeRemaining.seconds}s`;

    return (
      <div className={`inline-flex items-center gap-1.5 ${className}`}>
        {showIcon && (
          <Clock className={`w-3.5 h-3.5 ${critical ? 'text-status-error' : urgent ? 'text-status-warning' : 'text-text-muted'}`} />
        )}
        <span className={`font-mono text-sm ${critical ? 'text-status-error' : urgent ? 'text-status-warning' : 'text-text-muted'}`}>
          {timeString}
        </span>
      </div>
    );
  }

  // Detailed variant - shows full breakdown always
  if (variant === 'detailed') {
    return (
      <div className={`inline-flex items-center gap-3 ${className}`}>
        {showIcon && (
          <Clock className={`w-4 h-4 flex-shrink-0 ${critical ? 'text-status-error' : urgent ? 'text-status-warning' : 'text-text-muted'}`} />
        )}
        <div className="flex items-center gap-1.5">
          {timeRemaining.days > 0 && (
            <TimeUnit
              value={timeRemaining.days}
              label="d"
              size={size}
              isUrgent={urgent}
              isCritical={critical}
            />
          )}
          <TimeUnit
            value={timeRemaining.hours}
            label="h"
            size={size}
            isUrgent={urgent}
            isCritical={critical}
          />
          <TimeUnit
            value={timeRemaining.minutes}
            label="m"
            size={size}
            isUrgent={urgent}
            isCritical={critical}
          />
          <TimeUnit
            value={timeRemaining.seconds}
            label="s"
            size={size}
            isUrgent={urgent}
            isCritical={critical}
          />
        </div>
      </div>
    );
  }

  // With-progress variant - shows countdown + visual progress bar
  if (variant === 'with-progress' && createdAt) {
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="inline-flex items-center gap-3">
          {showIcon && (
            <Clock className={`w-4 h-4 flex-shrink-0 ${critical ? 'text-status-error' : urgent ? 'text-status-warning' : 'text-text-muted'}`} />
          )}
          <div className="flex items-center gap-1">
            {timeRemaining.days > 0 && (
              <>
                <TimeUnit value={timeRemaining.days} label="d" size={size} isUrgent={urgent} isCritical={critical} />
                <span className="text-text-muted">:</span>
              </>
            )}
            <TimeUnit value={timeRemaining.hours} label="h" size={size} isUrgent={urgent} isCritical={critical} />
            <span className="text-text-muted">:</span>
            <TimeUnit value={timeRemaining.minutes} label="m" size={size} isUrgent={urgent} isCritical={critical} />
            {timeRemaining.days === 0 && (
              <>
                <span className="text-text-muted">:</span>
                <TimeUnit value={timeRemaining.seconds} label="s" size={size} isUrgent={urgent} isCritical={critical} />
              </>
            )}
          </div>
        </div>
        <TimeProgressBar deadline={deadline} createdAt={createdAt} />
      </div>
    );
  }

  // Default variant - adaptive display
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={`inline-flex items-center gap-2 ${className}`}
    >
      {showIcon && (
        <Clock className={`w-4 h-4 flex-shrink-0 ${critical ? 'text-status-error' : urgent ? 'text-status-warning' : 'text-text-muted'}`} />
      )}
      <div className="flex items-center gap-1">
        {/* Days - only show if > 0 */}
        {timeRemaining.days > 0 && (
          <>
            <TimeUnit value={timeRemaining.days} label="d" size={size} isUrgent={urgent} isCritical={critical} />
            <span className="text-text-muted">:</span>
          </>
        )}
        
        {/* Hours */}
        <TimeUnit value={timeRemaining.hours} label="h" size={size} isUrgent={urgent} isCritical={critical} />
        <span className="text-text-muted">:</span>
        
        {/* Minutes */}
        <TimeUnit value={timeRemaining.minutes} label="m" size={size} isUrgent={urgent} isCritical={critical} />
        
        {/* Seconds - show when less than 1 day */}
        {timeRemaining.days === 0 && (
          <>
            <span className="text-text-muted">:</span>
            <TimeUnit value={timeRemaining.seconds} label="s" size={size} isUrgent={urgent} isCritical={critical} />
          </>
        )}
      </div>
    </motion.div>
  );
}

/**
 * Expired state component for bounties
 */
export function ExpiredBadge({ className = '' }: { className?: string }) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-status-error/10 border border-status-error/20 text-status-error text-xs font-medium ${className}`}>
      <AlertCircle className="w-3 h-3" />
      <span>Expired</span>
    </div>
  );
}

/**
 * Urgent indicator for bounties nearing deadline
 */
export function UrgentIndicator({ deadline, className = '' }: { deadline: string | Date; className?: string }) {
  const critical = isCritical(deadline);
  const urgent = isUrgent(deadline);

  if (!urgent && !critical) return null;

  return (
    <div
      data-testid="urgent-indicator"
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
        critical
          ? 'bg-status-error/10 text-status-error border border-status-error/20'
          : 'bg-status-warning/10 text-status-warning border border-status-warning/20'
      } ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${critical ? 'bg-status-error' : 'bg-status-warning'}`} />
      {critical ? 'Critical' : 'Urgent'}
    </div>
  );
}

/**
 * Time Progress Bar - Visual indicator of time remaining
 * UNIQUE FEATURE: Shows percentage of time elapsed with color gradient
 */
interface TimeProgressBarProps {
  deadline: string | Date;
  createdAt: string | Date;
  className?: string;
  showPercentage?: boolean;
}

export function TimeProgressBar({ deadline, createdAt, className = '', showPercentage = true }: TimeProgressBarProps) {
  const [progress, setProgress] = useState(() => calculateProgress(createdAt, deadline));

  const updateProgress = useCallback(() => {
    setProgress(calculateProgress(createdAt, deadline));
  }, [createdAt, deadline]);

  useEffect(() => {
    updateProgress();
    const interval = setInterval(updateProgress, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [updateProgress]);

  const getColorClass = () => {
    if (progress >= 90) return 'bg-status-error';
    if (progress >= 75) return 'bg-status-warning';
    if (progress >= 50) return 'bg-purple';
    return 'bg-emerald';
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-xs text-text-muted">
          <Hourglass className="w-3 h-3" />
          <span>Time Remaining</span>
        </div>
        {showPercentage && (
          <span className={`text-xs font-mono font-medium ${
            progress >= 90 ? 'text-status-error' :
            progress >= 75 ? 'text-status-warning' :
            progress >= 50 ? 'text-purple' : 'text-emerald'
          }`}>
            {Math.round(100 - progress)}%
          </span>
        )}
      </div>
      <div className="h-2 w-full bg-forge-800 rounded-full overflow-hidden border border-border/50">
        <motion.div
          className={`h-full rounded-full ${getColorClass()}`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(0, Math.min(100, 100 - progress))}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

/**
 * Calculate progress percentage based on created time and deadline
 */
function calculateProgress(createdAt: string | Date, deadline: string | Date): number {
  const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const end = typeof deadline === 'string' ? new Date(deadline) : deadline;
  const now = new Date();

  const total = end.getTime() - created.getTime();
  const elapsed = now.getTime() - created.getTime();

  if (total <= 0) return 100;
  if (elapsed <= 0) return 0;

  return Math.min(100, Math.max(0, (elapsed / total) * 100));
}
