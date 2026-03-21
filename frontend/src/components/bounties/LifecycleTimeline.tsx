import React from 'react';
import type { LifecycleLogEntry } from '../../types/bounty';

const EVENT_ICONS: Record<string, { icon: string; color: string }> = {
  bounty_created: { icon: '🆕', color: 'bg-blue-500' },
  bounty_status_changed: { icon: '🔄', color: 'bg-yellow-500' },
  bounty_cancelled: { icon: '❌', color: 'bg-red-500' },
  submission_created: { icon: '📤', color: 'bg-purple-500' },
  submission_status_changed: { icon: '🔄', color: 'bg-yellow-500' },
  ai_review_started: { icon: '🤖', color: 'bg-blue-400' },
  ai_review_completed: { icon: '🤖', color: 'bg-green-500' },
  creator_approved: { icon: '✅', color: 'bg-green-500' },
  creator_disputed: { icon: '⚠️', color: 'bg-red-500' },
  auto_approved: { icon: '⚡', color: 'bg-emerald-500' },
  payout_initiated: { icon: '💰', color: 'bg-yellow-500' },
  payout_confirmed: { icon: '💎', color: 'bg-emerald-500' },
  payout_failed: { icon: '🚫', color: 'bg-red-500' },
  dispute_opened: { icon: '⚖️', color: 'bg-orange-500' },
  dispute_resolved: { icon: '🏛️', color: 'bg-green-500' },
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatEventType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

interface LifecycleTimelineProps {
  entries: LifecycleLogEntry[];
  loading?: boolean;
}

export const LifecycleTimeline: React.FC<LifecycleTimelineProps> = ({ entries, loading }) => {
  if (loading) {
    return (
      <div className="bg-gray-900 rounded-lg p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-300 mb-4">Lifecycle</h2>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 bg-gray-800 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-300 mb-4">Lifecycle</h2>
        <p className="text-gray-500 text-sm text-center py-4">No activity yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-gray-300 mb-4">Lifecycle</h2>
      <div className="relative">
        <div className="absolute left-[15px] top-0 bottom-0 w-px bg-gray-700" />
        <div className="space-y-4">
          {entries.map((entry) => {
            const meta = EVENT_ICONS[entry.event_type] || { icon: '📋', color: 'bg-gray-500' };
            return (
              <div key={entry.id} className="flex items-start gap-3 relative">
                <div className={`w-8 h-8 rounded-full ${meta.color}/20 flex items-center justify-center text-sm shrink-0 z-10 bg-gray-900`}>
                  {meta.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-gray-200">
                      {formatEventType(entry.event_type)}
                    </p>
                    <span className="text-xs text-gray-500 shrink-0">
                      {formatTime(entry.created_at)}
                    </span>
                  </div>
                  {(entry.previous_state || entry.new_state) && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {entry.previous_state && <span>{entry.previous_state}</span>}
                      {entry.previous_state && entry.new_state && <span className="mx-1">→</span>}
                      {entry.new_state && <span className="text-white">{entry.new_state}</span>}
                    </p>
                  )}
                  {entry.actor_id && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      by {entry.actor_type === 'auto' ? 'System (auto)' : entry.actor_id.slice(0, 12) + '...'}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LifecycleTimeline;
