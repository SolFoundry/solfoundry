/**
 * MetricCard - Reusable stat card for analytics dashboards.
 *
 * Displays a single metric with label, value, optional change indicator,
 * and icon. Supports dark/light theming via Tailwind dark: classes.
 * Responsive: full width on mobile, fits in grid on larger screens.
 * @module components/analytics/MetricCard
 */

export interface MetricCardProps {
  /** Label text displayed above the value */
  label: string;
  /** Primary numeric or text value */
  value: string | number;
  /** Optional change from previous period (e.g., "+12%") */
  change?: string;
  /** Whether the change is positive (green) or negative (red) */
  changePositive?: boolean;
  /** Icon emoji or symbol displayed in the card */
  icon?: string;
  /** Additional CSS classes */
  className?: string;
  /** Test ID for testing */
  testId?: string;
}

/**
 * Renders a single metric card with value, label, and optional change indicator.
 *
 * Used in dashboard grids to display key statistics like total contributors,
 * bounties completed, and FNDRY paid. Fully responsive and theme-aware.
 */
export function MetricCard({
  label,
  value,
  change,
  changePositive = true,
  icon,
  className = '',
  testId,
}: MetricCardProps) {
  const formattedValue = typeof value === 'number' ? value.toLocaleString() : value;

  return (
    <div
      className={`rounded-xl border border-gray-700 dark:border-gray-700 bg-[#111111] dark:bg-[#111111] p-5 ${className}`}
      data-testid={testId}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-400 dark:text-gray-400 uppercase tracking-wider mb-1">
            {label}
          </p>
          <p className="text-2xl font-bold text-white dark:text-white truncate">
            {formattedValue}
          </p>
          {change && (
            <p
              className={`text-xs mt-1 font-medium ${
                changePositive
                  ? 'text-[#14F195]'
                  : 'text-red-400'
              }`}
            >
              {change}
            </p>
          )}
        </div>
        {icon && (
          <span className="text-2xl opacity-60 ml-3 shrink-0" aria-hidden="true">
            {icon}
          </span>
        )}
      </div>
    </div>
  );
}

export default MetricCard;
