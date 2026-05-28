import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { deadlineUrgency, timeLeft } from '../../lib/utils';

interface BountyCountdownProps {
  deadline?: string | null;
  className?: string;
}

export function BountyCountdown({ deadline, className = '' }: BountyCountdownProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!deadline) return;
    const id = window.setInterval(() => setTick((tick) => tick + 1), 60000);
    return () => window.clearInterval(id);
  }, [deadline]);

  if (!deadline) return null;

  const urgency = deadlineUrgency(deadline);
  const color = {
    normal: 'text-text-muted',
    warning: 'text-status-warning',
    urgent: 'text-status-error',
    expired: 'text-text-muted',
  }[urgency];

  return (
    <span
      className={`inline-flex items-center gap-1 ${color} ${className}`}
      data-testid={urgency === 'urgent' ? 'urgent-indicator' : undefined}
      aria-label={`Bounty deadline: ${timeLeft(deadline)}`}
    >
      <Clock className="w-3.5 h-3.5" />
      {timeLeft(deadline)}
    </span>
  );
}
