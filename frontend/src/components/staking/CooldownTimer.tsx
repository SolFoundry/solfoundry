/**
 * CooldownTimer — Unstaking cooldown period display with countdown timer.
 *
 * Renders a visual countdown showing the remaining time until unstaked tokens
 * are released, including a progress bar and formatted time display.
 * Updates every second while the cooldown is active.
 *
 * @module components/staking/CooldownTimer
 */
import { useCooldownTimer } from '../../hooks/useStaking';

/** Props for the CooldownTimer component. */
interface CooldownTimerProps {
  /** ISO 8601 timestamp when the cooldown period ends, or null if no cooldown. */
  cooldownEndsAt: string | null;
  /** Amount of $FNDRY tokens currently locked in the cooldown. */
  cooldownAmount: number;
}

/**
 * Format a token amount for human-readable display with commas.
 *
 * @param amount - Raw token amount.
 * @returns Formatted string with comma separators.
 */
function formatAmount(amount: number): string {
  return amount.toLocaleString('en-US');
}

/**
 * CooldownTimer — Displays unstaking cooldown state with live countdown.
 *
 * When a cooldown is active, shows:
 * - Remaining time as days/hours/minutes/seconds
 * - Progress bar showing how much of the cooldown has elapsed
 * - The amount of $FNDRY locked in cooldown
 *
 * When no cooldown is active, renders nothing (returns null).
 */
export function CooldownTimer({ cooldownEndsAt, cooldownAmount }: CooldownTimerProps) {
  const { isActive, formattedTime, progressPercent } = useCooldownTimer(cooldownEndsAt);

  if (!cooldownEndsAt || !isActive) return null;

  return (
    <div
      className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4"
      data-testid="cooldown-timer"
      role="timer"
      aria-label={`Unstaking cooldown: ${formattedTime} remaining`}
    >
      <div className="flex items-start gap-3">
        {/* Clock icon */}
        <div className="flex-shrink-0 mt-0.5">
          <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-amber-400">Unstaking Cooldown</h4>
            <span className="text-xs text-gray-400 font-mono">{formatAmount(cooldownAmount)} $FNDRY</span>
          </div>

          {/* Countdown display */}
          <p className="text-xl font-bold text-white font-mono mt-2" data-testid="cooldown-remaining">
            {formattedTime}
          </p>
          <p className="text-xs text-gray-500 mt-1">remaining until tokens are released</p>

          {/* Progress bar */}
          <div className="mt-3">
            <div
              className="w-full bg-surface-300 rounded-full h-1.5"
              role="progressbar"
              aria-valuenow={Math.round(progressPercent)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Cooldown progress"
            >
              <div
                className="h-1.5 rounded-full bg-amber-400 transition-all duration-1000"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-600">Initiated</span>
              <span className="text-xs text-gray-600">{Math.round(progressPercent)}% complete</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
