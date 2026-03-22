import React from 'react';
import { clsx } from 'clsx';

export type Trend = 'up' | 'down' | 'neutral';

export interface StatsCardProps {
  /** Card title shown above the metric */
  title: string;
  /** Primary metric value — can be a number or pre-formatted string */
  value: string | number;
  /** Optional secondary descriptor (e.g. "FNDRY tokens", "+12 this week") */
  subtitle?: string;
  /** Trend indicator shown as a coloured badge */
  trend?: Trend;
  /** Percentage change to display next to the trend arrow */
  trendValue?: string;
  /** Icon rendered in the top-right corner */
  icon?: React.ReactNode;
  /** Extra Tailwind classes applied to the outer container */
  className?: string;
  /** Whether the card should enter a loading skeleton state */
  loading?: boolean;
  /** Click handler — makes the card interactive */
  onClick?: () => void;
}

const trendConfig: Record<Trend, { color: string; arrow: string; label: string }> = {
  up: { color: 'text-emerald-400 bg-emerald-400/10', arrow: '↑', label: 'Increased' },
  down: { color: 'text-red-400 bg-red-400/10', arrow: '↓', label: 'Decreased' },
  neutral: { color: 'text-slate-400 bg-slate-400/10', arrow: '→', label: 'Unchanged' },
};

/**
 * StatsCard — reusable metric card for the SolFoundry admin dashboard.
 *
 * Usage:
 * ```tsx
 * <StatsCard
 *   title="Total Bounties"
 *   value={142}
 *   subtitle="across all tiers"
 *   trend="up"
 *   trendValue="+8%"
 *   icon={<Award className="w-5 h-5" />}
 * />
 * ```
 */
export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  icon,
  className,
  loading = false,
  onClick,
}) => {
  const trendCfg = trend ? trendConfig[trend] : null;

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) onClick();
      }}
      className={clsx(
        'relative rounded-xl border border-slate-700/60 bg-slate-800/60 p-5 backdrop-blur-sm',
        'transition-all duration-200',
        onClick && 'cursor-pointer hover:border-violet-500/40 hover:bg-slate-800/80 hover:shadow-lg hover:shadow-violet-900/10',
        className,
      )}
    >
      {/* Header row: title + optional icon */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-400">{title}</p>
        {icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400">
            {icon}
          </span>
        )}
      </div>

      {/* Metric value */}
      {loading ? (
        <div className="mb-2 h-8 w-32 animate-pulse rounded-md bg-slate-700" />
      ) : (
        <p className="mb-1 text-3xl font-bold tracking-tight text-white">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
      )}

      {/* Bottom row: subtitle + trend badge */}
      <div className="flex flex-wrap items-center gap-2">
        {subtitle && (
          <span className="text-xs text-slate-500">{subtitle}</span>
        )}
        {trendCfg && (
          <span
            aria-label={`${trendCfg.label}${trendValue ? ` by ${trendValue}` : ''}`}
            className={clsx(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
              trendCfg.color,
            )}
          >
            <span aria-hidden="true">{trendCfg.arrow}</span>
            {trendValue}
          </span>
        )}
      </div>

      {/* Subtle gradient accent on the left edge */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-0.5 rounded-l-xl bg-gradient-to-b from-violet-500/60 via-violet-500/20 to-transparent" />
    </div>
  );
};

export default StatsCard;
