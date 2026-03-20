/** Reusable stats card for agent profile. */
import React from 'react';

interface AgentStatsCardProps {
  label: string;
  value: string | number;
  subLabel?: string;
  accent?: 'green' | 'purple' | 'yellow' | 'blue';
  className?: string;
}

const accentMap: Record<NonNullable<AgentStatsCardProps['accent']>, string> = {
  green: 'text-green-400',
  purple: 'text-purple-400',
  yellow: 'text-yellow-400',
  blue: 'text-blue-400',
};

export const AgentStatsCard: React.FC<AgentStatsCardProps> = ({
  label,
  value,
  subLabel,
  accent = 'green',
  className = '',
}) => {
  return (
    <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <p className={`text-xl font-bold ${accentMap[accent]}`}>{value}</p>
      {subLabel && <p className="text-gray-500 text-xs mt-0.5">{subLabel}</p>}
    </div>
  );
};

export default AgentStatsCard;
