import React from 'react';
import { cn } from '../../lib/utils';

interface MetricCardProps {
  label: string;
  value: string | number;
  change?: string;
  changePositive?: boolean;
  icon?: string;
  testId?: string;
  className?: string;
}

export function MetricCard({
  label,
  value,
  change,
  changePositive,
  icon,
  testId,
  className,
}: MetricCardProps) {
  // Format numeric values with locale string
  const formattedValue = typeof value === 'number' 
    ? value.toLocaleString() 
    : value;

  return (
    <div
      data-testid={testId}
      className={cn(
        'bg-forge-900 border border-forge-800 rounded-xl p-6',
        className
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-foreground">{formattedValue}</span>
        {change && (
          <span
            className={cn(
              'text-sm font-medium',
              changePositive ? 'text-emerald-400' : 'text-red-400'
            )}
          >
            {change}
          </span>
        )}
      </div>
    </div>
  );
}
