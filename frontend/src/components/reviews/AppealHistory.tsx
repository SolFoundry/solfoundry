import React from 'react';
import type { AppealHistoryEntry } from '../../hooks/useReviewScores';

const ACTION_COLORS: Record<string, string> = {
  filed:    'bg-yellow-500',
  assigned: 'bg-blue-500',
  reviewing:'bg-purple-500',
  resolved: 'bg-[#14F195]',
  dismissed:'bg-white/20',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

interface Props {
  history: AppealHistoryEntry[];
}

export function AppealHistory({ history }: Props) {
  if (!history.length) {
    return <p className="text-sm text-white/40 text-center py-4">No appeal history yet.</p>;
  }

  return (
    <ol className="relative border-l border-white/10 space-y-5 pl-6">
      {history.map((entry) => (
        <li
          key={entry.id}
          data-testid={`appeal-history-entry-${entry.id}`}
          className="relative"
        >
          <span
            className={`absolute -left-[1.625rem] top-1 w-3 h-3 rounded-full ${
              ACTION_COLORS[entry.action] ?? 'bg-white/20'
            }`}
          />
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-xs font-semibold text-white capitalize">{entry.action}</p>
              <span className="text-xs text-white/30">{fmtDate(entry.created_at)}</span>
            </div>
            <p className="text-xs text-white/50">{entry.actor}</p>
            {entry.note && (
              <p className="text-xs text-white/70 mt-0.5">{entry.note}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
