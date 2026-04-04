import React from 'react';
import type { DisputeHistoryItem } from '../../types/dispute';

function formatAction(action: string): string {
  return action
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const ACTION_COLORS: Record<string, string> = {
  dispute_opened:      'bg-yellow-500',
  evidence_submitted:  'bg-blue-500',
  moved_to_mediation:  'bg-purple-500',
  resolved:            'bg-[#14F195]',
  closed:              'bg-white/20',
};

interface Props {
  history: DisputeHistoryItem[];
}

export function DisputeTimeline({ history }: Props) {
  if (history.length === 0) {
    return <p className="text-sm text-white/40 text-center py-6">No history entries yet.</p>;
  }

  return (
    <ol data-testid="dispute-timeline" className="relative border-l border-white/10 space-y-6 pl-6">
      {history.map((entry) => (
        <li
          key={entry.id}
          data-testid={`timeline-entry-${entry.action}`}
          className="relative"
        >
          {/* Dot */}
          <span
            className={`absolute -left-[1.625rem] top-1 w-3 h-3 rounded-full ${
              ACTION_COLORS[entry.action] ?? 'bg-white/20'
            }`}
          />

          {/* Content */}
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm font-semibold text-white">{formatAction(entry.action)}</p>
              <span className="text-xs text-white/30">{fmtDate(entry.created_at)}</span>
            </div>

            {/* Status transition */}
            {entry.previous_status && (
              <p className="text-xs text-white/40 mb-1">
                <span className="text-white/30">{entry.previous_status}</span>
                {' → '}
                <span className="text-white/70">{entry.new_status}</span>
              </p>
            )}
            {!entry.previous_status && (
              <p className="text-xs text-white/40 mb-1">{entry.new_status}</p>
            )}

            {entry.notes && (
              <p className="text-xs text-white/50">{entry.notes}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
