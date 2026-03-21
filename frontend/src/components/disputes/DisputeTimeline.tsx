/**
 * DisputeTimeline Component
 * 
 * Visual timeline of dispute history events.
 */

import React from 'react';

interface DisputeHistory {
  id: string;
  action: string;
  previous_state?: string;
  new_state?: string;
  actor_id: string;
  actor_role: string;
  notes?: string;
  created_at: string;
}

interface DisputeTimelineProps {
  history: DisputeHistory[];
}

const ACTION_LABELS: Record<string, string> = {
  dispute_created: 'Dispute Created',
  evidence_submitted: 'Evidence Submitted',
  mediation_started: 'Mediation Started',
  auto_resolved: 'Auto-Resolved by AI',
  dispute_resolved: 'Dispute Resolved',
};

const ACTION_COLORS: Record<string, string> = {
  dispute_created: 'bg-blue-500',
  evidence_submitted: 'bg-yellow-500',
  mediation_started: 'bg-purple-500',
  auto_resolved: 'bg-green-500',
  dispute_resolved: 'bg-green-600',
};

const ROLE_COLORS: Record<string, string> = {
  contributor: 'bg-blue-100 text-blue-800',
  creator: 'bg-orange-100 text-orange-800',
  admin: 'bg-purple-100 text-purple-800',
  system: 'bg-gray-100 text-gray-800',
};

export function DisputeTimeline({ history }: DisputeTimelineProps) {
  if (!history || history.length === 0) {
    return (
      <p className="text-gray-500 italic">No history available</p>
    );
  }

  // Sort history by created_at descending (newest first)
  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="space-y-4">
      {sortedHistory.map((event, index) => (
        <div key={event.id} className="relative">
          {/* Connector line */}
          {index < sortedHistory.length - 1 && (
            <div className="absolute left-4 top-8 w-0.5 h-full bg-gray-200" />
          )}

          <div className="flex gap-4">
            {/* Icon */}
            <div className={`w-8 h-8 rounded-full ${ACTION_COLORS[event.action] || 'bg-gray-400'} flex items-center justify-center flex-shrink-0`}>
              <EventIcon action={event.action} />
            </div>

            {/* Content */}
            <div className="flex-1 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-gray-900">
                  {ACTION_LABELS[event.action] || event.action}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${ROLE_COLORS[event.actor_role] || 'bg-gray-100 text-gray-800'}`}>
                  {event.actor_role}
                </span>
              </div>

              {event.previous_state && event.new_state && (
                <div className="text-sm text-gray-600 mb-1">
                  State: {event.previous_state} → {event.new_state}
                </div>
              )}

              {event.notes && (
                <p className="text-sm text-gray-600">{event.notes}</p>
              )}

              <p className="text-xs text-gray-400 mt-1">
                {new Date(event.created_at).toLocaleDateString()} at{' '}
                {new Date(event.created_at).toLocaleTimeString()}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EventIcon({ action }: { action: string }) {
  const iconClass = "w-4 h-4 text-white";

  switch (action) {
    case 'dispute_created':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    case 'evidence_submitted':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case 'mediation_started':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      );
    case 'auto_resolved':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      );
    case 'dispute_resolved':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    default:
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
}

export default DisputeTimeline;