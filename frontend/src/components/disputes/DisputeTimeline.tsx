/**
 * DisputeTimeline — Chronological timeline of dispute events.
 *
 * Renders each audit history entry as a node in a vertical timeline,
 * showing the action, status transition, actor, and timestamp.
 * @module components/disputes/DisputeTimeline
 */

import React from 'react';
import type { DisputeHistoryItem } from '../../types/dispute';

/** Icon and color mapping for timeline action types. */
const ACTION_STYLES: Record<string, { color: string; icon: string; label: string }> = {
  dispute_opened: {
    color: 'bg-yellow-500',
    icon: '!',
    label: 'Dispute Opened',
  },
  evidence_submitted: {
    color: 'bg-blue-500',
    icon: '+',
    label: 'Evidence Submitted',
  },
  moved_to_mediation: {
    color: 'bg-purple-500',
    icon: 'M',
    label: 'Moved to Mediation',
  },
  ai_mediation_completed: {
    color: 'bg-indigo-500',
    icon: 'AI',
    label: 'AI Mediation Complete',
  },
  auto_resolved_by_ai: {
    color: 'bg-green-500',
    icon: 'R',
    label: 'Auto-Resolved by AI',
  },
  dispute_resolved: {
    color: 'bg-green-500',
    icon: 'R',
    label: 'Dispute Resolved',
  },
};

/** Default style for unknown action types. */
const DEFAULT_STYLE = {
  color: 'bg-gray-500',
  icon: '?',
  label: 'Action',
};

/** Props for the DisputeTimeline component. */
export interface DisputeTimelineProps {
  /** Ordered list of dispute history entries. */
  history: DisputeHistoryItem[];
}

/**
 * Vertical timeline showing the chronological history of a dispute.
 *
 * Each entry shows the action taken, who performed it, any notes,
 * and the status transition if applicable.
 */
export const DisputeTimeline: React.FC<DisputeTimelineProps> = ({ history }) => {
  if (!history || history.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-300 mb-4">Timeline</h3>
        <p className="text-gray-500 text-sm">No history entries yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg p-4 sm:p-6" data-testid="dispute-timeline">
      <h3 className="text-lg font-semibold text-gray-300 mb-6">Timeline</h3>

      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-700" />

        <div className="space-y-6">
          {history.map((entry, index) => {
            const style = ACTION_STYLES[entry.action] || DEFAULT_STYLE;
            const isLast = index === history.length - 1;
            const timestamp = new Date(entry.created_at).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={entry.id}
                className="relative pl-10"
                data-testid={`timeline-entry-${entry.action}`}
              >
                {/* Timeline node */}
                <div
                  className={`absolute left-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${style.color} ${
                    isLast ? 'ring-2 ring-offset-2 ring-offset-gray-900 ring-current' : ''
                  }`}
                >
                  {style.icon.length <= 2 ? style.icon : style.icon[0]}
                </div>

                <div className="bg-gray-800/50 rounded-lg p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-medium text-white">
                      {style.label}
                    </span>
                    <span className="text-xs text-gray-500">{timestamp}</span>
                  </div>

                  {/* Status transition */}
                  {entry.previous_status && entry.new_status && entry.previous_status !== entry.new_status && (
                    <div className="text-xs text-gray-400 mb-1">
                      <span className="text-gray-500">{entry.previous_status}</span>
                      <span className="mx-1 text-gray-600">&rarr;</span>
                      <span className="text-[#9945FF]">{entry.new_status}</span>
                    </div>
                  )}

                  {/* Notes */}
                  {entry.notes && (
                    <p className="text-xs text-gray-400 mt-1">{entry.notes}</p>
                  )}

                  {/* Actor */}
                  <div className="text-xs text-gray-600 mt-1">
                    by {entry.actor_id.slice(0, 8)}...
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DisputeTimeline;
