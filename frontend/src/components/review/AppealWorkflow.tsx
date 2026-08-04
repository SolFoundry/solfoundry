import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Scale, UserCheck, MessageSquare, ThumbsUp, ThumbsDown, Clock, AlertTriangle } from 'lucide-react';
import type { Appeal, AppealStatus } from '../../types/review';
import { useAppealTimeline } from '../../hooks/useReviews';

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const STATUS_META: Record<AppealStatus, { label: string; color: string; bg: string; border: string }> = {
  open: { label: 'Open', color: 'text-status-warning', bg: 'bg-status-warning/5', border: 'border-status-warning/20' },
  in_review: { label: 'In Review', color: 'text-status-info', bg: 'bg-status-info/5', border: 'border-status-info/20' },
  resolved: { label: 'Resolved', color: 'text-emerald', bg: 'bg-emerald-bg', border: 'border-emerald-border' },
  dismissed: { label: 'Dismissed', color: 'text-status-error', bg: 'bg-status-error/5', border: 'border-status-error/20' },
};

interface AppealWorkflowProps {
  appeal: Appeal;
  onAssign?: (appealId: string) => void;
  onResolve?: (appealId: string, resolution: string, status: 'resolved' | 'dismissed') => void;
  isReviewer?: boolean;
}

export function AppealWorkflow({ appeal, onAssign, onResolve, isReviewer = false }: AppealWorkflowProps) {
  const [showTimeline, setShowTimeline] = useState(false);
  const [resolutionText, setResolutionText] = useState('');
  const [showResolve, setShowResolve] = useState(false);
  const { data: timeline } = useAppealTimeline(showTimeline ? appeal.id : undefined);

  const meta = STATUS_META[appeal.status];

  return (
    <motion.div variants={fadeIn} initial="initial" animate="animate" className="rounded-xl border border-border bg-forge-900 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-bg border border-purple-border flex items-center justify-center">
            <Scale className="w-4 h-4 text-purple-light" />
          </div>
          <div>
            <h3 className="font-sans text-lg font-semibold text-text-primary">Appeal #{appeal.id.slice(0, 8)}</h3>
            <p className="text-xs text-text-muted">
              by {appeal.appellant_username} &middot; {new Date(appeal.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${meta.color} ${meta.bg} ${meta.border}`}>
          {meta.label}
        </span>
      </div>

      {/* Reason */}
      <div className="mb-4 p-3 rounded-lg bg-forge-800 border border-border">
        <p className="text-xs font-semibold text-text-muted mb-1">Reason for Appeal</p>
        <p className="text-sm text-text-secondary">{appeal.reason}</p>
      </div>

      {appeal.evidence && (
        <div className="mb-4 p-3 rounded-lg bg-forge-800 border border-border">
          <p className="text-xs font-semibold text-text-muted mb-1">Evidence</p>
          <p className="text-sm text-text-secondary whitespace-pre-wrap">{appeal.evidence}</p>
        </div>
      )}

      {/* Assigned reviewer */}
      {appeal.assigned_human_reviewer && (
        <div className="flex items-center gap-2 mb-4 p-2 rounded-lg bg-status-info/5 border border-status-info/20">
          <UserCheck className="w-3.5 h-3.5 text-status-info" />
          <span className="text-xs text-text-secondary">
            Assigned to: <span className="font-medium text-text-primary">{appeal.assigned_human_reviewer}</span>
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Assign reviewer */}
        {isReviewer && appeal.status === 'open' && onAssign && (
          <button
            onClick={() => onAssign(appeal.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-forge-800 border border-border hover:border-border-hover text-xs font-medium text-text-primary transition-colors duration-150"
          >
            <UserCheck className="w-3.5 h-3.5" />
            Assign to me
          </button>
        )}

        {/* Resolve / Dismiss */}
        {isReviewer && (appeal.status === 'in_review' || appeal.status === 'open') && (
          <button
            onClick={() => setShowResolve(!showResolve)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-forge-800 border border-border hover:border-border-hover text-xs font-medium text-text-primary transition-colors duration-150"
          >
            <ThumbsUp className="w-3.5 h-3.5" />
            {showResolve ? 'Cancel' : 'Resolve'}
          </button>
        )}

        {/* Timeline toggle */}
        <button
          onClick={() => setShowTimeline(!showTimeline)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-forge-800 border border-border hover:border-border-hover text-xs font-medium text-text-muted hover:text-text-primary transition-colors duration-150 ml-auto"
        >
          <Clock className="w-3.5 h-3.5" />
          Timeline
        </button>
      </div>

      {/* Resolve form */}
      {showResolve && (
        <div className="mt-4 p-4 rounded-lg border border-border bg-forge-850 space-y-3">
          <textarea
            value={resolutionText}
            onChange={(e) => setResolutionText(e.target.value)}
            placeholder="Write your resolution notes..."
            className="w-full h-20 px-3 py-2 rounded-lg bg-forge-800 border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-active resize-none"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => onResolve?.(appeal.id, resolutionText, 'resolved')}
              disabled={!resolutionText.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald/20 border border-emerald-border text-xs font-medium text-emerald hover:bg-emerald/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
            >
              <ThumbsUp className="w-3.5 h-3.5" /> Approve Appeal
            </button>
            <button
              onClick={() => onResolve?.(appeal.id, resolutionText, 'dismissed')}
              disabled={!resolutionText.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-status-error/10 border border-status-error/30 text-xs font-medium text-status-error hover:bg-status-error/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
            >
              <ThumbsDown className="w-3.5 h-3.5" /> Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Timeline */}
      {showTimeline && timeline && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Timeline</p>
          {timeline.length === 0 ? (
            <p className="text-xs text-text-muted">No events recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {timeline.map((event) => (
                <div key={event.id} className="flex items-start gap-2 p-2 rounded-lg bg-forge-800">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-text-secondary">{event.description}</p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {event.created_by} &middot; {new Date(event.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Resolution */}
      {appeal.resolution && (
        <div className="mt-4 p-3 rounded-lg border border-emerald-border bg-emerald-bg/30">
          <p className="text-xs font-semibold text-emerald mb-1">Resolution</p>
          <p className="text-sm text-text-secondary">{appeal.resolution}</p>
          {appeal.reviewer_notes && (
            <p className="text-xs text-text-muted mt-1 italic">{appeal.reviewer_notes}</p>
          )}
        </div>
      )}
    </motion.div>
  );
}

interface AppealHistoryProps {
  appeals: Appeal[];
  onAssign?: (appealId: string) => void;
  onResolve?: (appealId: string, resolution: string, status: 'resolved' | 'dismissed') => void;
  isReviewer?: boolean;
}

export function AppealHistory({ appeals, onAssign, onResolve, isReviewer }: AppealHistoryProps) {
  if (appeals.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-forge-900 p-8 text-center">
        <Scale className="w-8 h-8 text-text-muted mx-auto mb-2" />
        <p className="text-text-muted text-sm">No appeals yet.</p>
        <p className="text-text-muted text-xs mt-1">Appeals will appear here when submissions are disputed.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-sans text-lg font-semibold text-text-primary">Appeal History</h3>
      {appeals.map((appeal) => (
        <AppealWorkflow
          key={appeal.id}
          appeal={appeal}
          onAssign={onAssign}
          onResolve={onResolve}
          isReviewer={isReviewer}
        />
      ))}
    </div>
  );
}