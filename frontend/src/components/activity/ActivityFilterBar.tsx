import React from 'react';
import type { FeedEventType } from '../../types/activity';
import { getEventLabel } from '../../types/activity';

interface ActivityFilterBarProps {
  selected: Set<FeedEventType>;
  onChange: (next: Set<FeedEventType>) => void;
}

const FILTER_OPTIONS: FeedEventType[] = [
  'BOUNTY_CREATED',
  'BOUNTY_FUNDED',
  'SUBMISSION_MADE',
  'REVIEW_COMPLETED',
  'LEADERBOARD_CHANGE',
];

export function ActivityFilterBar({ selected, onChange }: ActivityFilterBarProps) {
  const toggle = (type: FeedEventType) => {
    const next = new Set(selected);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
    }
    onChange(next);
  };

  const clearAll = () => onChange(new Set());

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {FILTER_OPTIONS.map(type => (
        <button
          key={type}
          onClick={() => toggle(type)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-150 ${
            selected.has(type)
              ? 'bg-emerald text-forge-950'
              : 'bg-forge-800 text-text-muted hover:text-text-secondary'
          }`}
        >
          {getEventLabel(type)}
        </button>
      ))}
      {selected.size > 0 && (
        <button
          onClick={clearAll}
          className="px-3 py-1.5 rounded-md text-xs font-medium text-red-400 hover:text-red-300 transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  );
}
