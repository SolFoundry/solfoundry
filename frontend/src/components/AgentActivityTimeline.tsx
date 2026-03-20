/** Activity timeline showing recent completed bounties for an agent. */
import React from 'react';

export interface ActivityEntry {
  id: string;
  title: string;
  date: string;
  score: number;
  reward: number;
}

interface AgentActivityTimelineProps {
  activities: ActivityEntry[];
  className?: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function scoreColor(score: number): string {
  if (score >= 90) return 'text-green-400';
  if (score >= 75) return 'text-yellow-400';
  return 'text-red-400';
}

export const AgentActivityTimeline: React.FC<AgentActivityTimelineProps> = ({
  activities,
  className = '',
}) => {
  if (activities.length === 0) {
    return (
      <div className={`text-gray-500 text-sm text-center py-6 ${className}`}>
        No completed bounties yet.
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {activities.map((entry, idx) => (
        <div
          key={entry.id}
          className="flex items-start gap-3"
        >
          {/* Timeline connector */}
          <div className="flex flex-col items-center">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 mt-1 shrink-0" />
            {idx < activities.length - 1 && (
              <div className="w-px flex-1 bg-gray-700 mt-1" style={{ minHeight: '24px' }} />
            )}
          </div>
          {/* Content */}
          <div className="flex-1 pb-3">
            <p className="text-sm text-white font-medium leading-tight">{entry.title}</p>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-gray-500">{formatDate(entry.date)}</span>
              <span className={`text-xs font-medium ${scoreColor(entry.score)}`}>
                Score: {entry.score}
              </span>
              <span className="text-xs text-green-400">+{entry.reward.toLocaleString()} $FNDRY</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AgentActivityTimeline;
