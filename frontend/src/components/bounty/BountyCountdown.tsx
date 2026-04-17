import React from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { useCountdown } from '../../hooks/useCountdown';

interface BountyCountdownProps {
  deadline: string | null | undefined;
  /** 'compact' = single line for cards, 'full' = segmented display for detail page */
  variant?: 'compact' | 'full';
  className?: string;
}

/**
 * Countdown timer component that shows time remaining until a bounty deadline.
 *
 * - Updates every second (real-time)
 * - Turns amber when < 24 hours remain
 * - Turns red with pulsing animation when < 1 hour remains
 * - Shows "Expired" when the deadline has passed
 * - Responsive: stacks segments on very small screens
 */
export function BountyCountdown({ deadline, variant = 'compact', className = '' }: BountyCountdownProps) {
  const { days, hours, minutes, seconds, isExpired, isUrgent, isWarning } = useCountdown(deadline);

  // ── Color / style logic ──────────────────────────────────────────
  let colorClasses = 'text-emerald border-emerald-border bg-emerald-bg';
  if (isWarning) colorClasses = 'text-status-warning border-yellow-500/30 bg-yellow-500/8';
  if (isUrgent) colorClasses = 'text-status-error border-red-500/30 bg-red-500/8 animate-pulse-glow';
  if (isExpired) colorClasses = 'text-text-muted border-border bg-forge-800';

  const iconColor = isUrgent ? 'text-status-error' : isWarning ? 'text-status-warning' : 'text-emerald';

  // ── Compact variant (single line, used in BountyCard) ────────────
  if (variant === 'compact') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-xs font-mono ${colorClasses} px-2 py-0.5 rounded-full border ${className}`}
      >
        {isExpired ? (
          <>Expired</>
        ) : (
          <>
            <Clock className={`w-3 h-3 ${iconColor}`} />
            {days > 0 && <>{days}d </>}
            {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}
            {isUrgent && <AlertTriangle className="w-3 h-3 text-status-error" />}
          </>
        )}
      </span>
    );
  }

  // ── Full variant (segmented boxes, used on detail page) ──────────
  return (
    <div className={`${className}`}>
      {isExpired ? (
        <div className={`flex items-center gap-2 font-mono text-sm ${colorClasses} px-3 py-2 rounded-lg border`}>
          <Clock className="w-4 h-4" />
          <span className="font-semibold">Expired</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {/* Warning / urgent label */}
          {isUrgent && (
            <span className="flex items-center gap-1 text-xs font-medium text-status-error mr-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Urgent!</span>
            </span>
          )}
          {!isUrgent && isWarning && (
            <span className="flex items-center gap-1 text-xs font-medium text-status-warning mr-1">
              <Clock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ending soon</span>
            </span>
          )}

          {/* Time segments */}
          <div className="flex items-center gap-1.5">
            <Segment value={days} label="Days" accent={colorClasses} />
            <Separator accent={colorClasses} />
            <Segment value={hours} label="Hrs" accent={colorClasses} />
            <Separator accent={colorClasses} />
            <Segment value={minutes} label="Min" accent={colorClasses} />
            <Separator accent={colorClasses} />
            <Segment value={seconds} label="Sec" accent={colorClasses} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Internal helpers ─────────────────────────────────────────────────

function Segment({ value, label, accent }: { value: number; label: string; accent: string }) {
  return (
    <div className={`flex flex-col items-center rounded-lg border px-2.5 py-1.5 min-w-[3rem] ${accent}`}>
      <span className="font-mono text-lg font-bold leading-none">{String(value).padStart(2, '0')}</span>
      <span className="text-[10px] uppercase tracking-wider mt-0.5 opacity-70">{label}</span>
    </div>
  );
}

function Separator({ accent }: { accent: string }) {
  return <span className={`text-lg font-bold ${accent} select-none`}>:</span>;
}

export default BountyCountdown;
