import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface BountyTimerProps {
  deadline: string | Date | number;
  className?: string;
}

export function BountyTimer({ deadline, className = '' }: BountyTimerProps) {
  const [timeLeftStr, setTimeLeftStr] = useState<string>('');
  const [urgency, setUrgency] = useState<'normal' | 'warning' | 'urgent' | 'expired'>('normal');

  useEffect(() => {
    if (!deadline) {
      setTimeLeftStr('No deadline');
      setUrgency('normal');
      return;
    }

    const calculateTime = () => {
      const targetDate = new Date(deadline);
      const now = new Date();
      const diffMs = targetDate.getTime() - now.getTime();

      if (diffMs <= 0) {
        setTimeLeftStr('Expired');
        setUrgency('expired');
        return;
      }

      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMs < 3600000) {
        setUrgency('urgent');
      } else if (diffMs < 86400000) {
        setUrgency('warning');
      } else {
        setUrgency('normal');
      }

      if (diffDays > 0) {
        setTimeLeftStr(`${diffDays}d left`);
      } else {
        const remainingHours = diffHours % 24;
        const remainingMins = diffMins % 60;
        const remainingSecs = Math.floor((diffMs % 60000) / 1000);
        
        setTimeLeftStr(
          `${remainingHours}h ${remainingMins}m ${remainingSecs}s`
        );
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  // Taste-skill minimalist style: 
  // No bloated glassmorphism boxes (which look artificial/AI-generated)
  // Use plain clean text aligned horizontally, color-coded precisely.
  // We keep it flat, clean, aligning cleanly with the PR label.
  const colorStyles = {
    normal: 'text-text-muted hover:text-text-secondary transition-colors duration-150',
    warning: 'text-status-warning font-medium',
    urgent: 'text-status-error font-semibold animate-pulse',
    expired: 'text-text-muted/40 line-through',
  };

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-mono transition-all duration-300 ${colorStyles[urgency]} ${className}`}>
      <Clock className={`w-3.5 h-3.5 flex-shrink-0 ${urgency === 'urgent' ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
      <span>{timeLeftStr}</span>
    </span>
  );
}
