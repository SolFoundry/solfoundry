import React from 'react';

export interface StatCardProps {
  label: string;
  value: string | number;
  icon?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon,
  trend,
  trendValue,
  className = '',
}: StatCardProps) {
  return (
    <div className={`stat-card ${className}`}>
      <div className="stat-card__header">
        {icon && <span className="stat-card__icon">{icon}</span>}
        <span className="stat-card__label">{label}</span>
      </div>
      <div className="stat-card__value">{value}</div>
      {trend && trendValue && (
        <div className={`stat-card__trend stat-card__trend--${trend}`}>
          {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
        </div>
      )}
      <style>{statCardStyles}</style>
    </div>
  );
}

const statCardStyles = `
.stat-card {
  background: #1a1a2e;
  border-radius: 10px;
  padding: 16px;
  border: 1px solid #2d2d44;
  transition: all 0.2s ease;
}

.stat-card:hover {
  border-color: #4a4a6a;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.stat-card__header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.stat-card__icon {
  font-size: 16px;
}

.stat-card__label {
  font-size: 12px;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-card__value {
  font-size: 24px;
  font-weight: 700;
  color: #f8fafc;
}

.stat-card__trend {
  font-size: 12px;
  margin-top: 4px;
  font-weight: 500;
}

.stat-card__trend--up {
  color: #10b981;
}

.stat-card__trend--down {
  color: #ef4444;
}

.stat-card__trend--neutral {
  color: #6b7280;
}
`;
