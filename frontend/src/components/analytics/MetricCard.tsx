import React from 'react';

interface MetricCardProps {
  label: string;
  value: number | string;
  change?: string;
  changePositive?: boolean;
  icon?: string;
  testId?: string;
  subtitle?: string;
}

export function MetricCard({ label, value, change, changePositive, icon, testId, subtitle }: MetricCardProps) {
  const displayValue =
    typeof value === 'number' ? value.toLocaleString() : value;

  return (
    <div
      data-testid={testId}
      className="bg-[#0d0d1a] border border-white/10 rounded-xl p-4"
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs text-white/50">{label}</p>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <p className="text-2xl font-bold text-white">{displayValue}</p>
      {subtitle && <p className="text-xs text-white/40 mt-0.5">{subtitle}</p>}
      {change !== undefined && (
        <p className={`text-xs mt-1 font-medium ${changePositive ? 'text-[#14F195]' : 'text-red-400'}`}>
          {change}
        </p>
      )}
    </div>
  );
}
