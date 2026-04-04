/**
 * AppealWorkflow — file, track, and resolve score appeals.
 */
import React, { useState } from 'react';
import { useAppeal } from '../../hooks/useReviewScores';

const STATUS_STYLES: Record<string, string> = {
  pending:    'bg-yellow-500/20 text-yellow-400',
  assigned:   'bg-blue-500/20 text-blue-400',
  reviewing:  'bg-purple-500/20 text-purple-400',
  resolved:   'bg-[#14F195]/20 text-[#14F195]',
  dismissed:  'bg-white/10 text-white/40',
};

interface Props {
  submissionId: string;
}

export function AppealWorkflow({ submissionId }: Props) {
  const { appeal, fileAppeal, isLoading } = useAppeal(submissionId);
  const [formOpen, setFormOpen] = useState(false);
  const [reason, setReason] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return;
    fileAppeal({ reason: reason.trim() });
    setFormOpen(false);
    setReason('');
  }

  // ── No appeal yet ──────────────────────────────────────────────────────────
  if (!appeal) {
    return (
      <div className="bg-[#0d0d1a] border border-white/10 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-1">Appeal Scores</h3>
        <p className="text-xs text-white/50 mb-4">
          Dispute the AI-generated scores and request a human review.
        </p>

        {!formOpen ? (
          <button
            onClick={() => setFormOpen(true)}
            className="px-4 py-2 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-lg text-sm font-medium hover:bg-yellow-500/30"
          >
            File Appeal
          </button>
        ) : (
          <form data-testid="appeal-form" onSubmit={handleSubmit} className="space-y-3">
            <textarea
              data-testid="appeal-reason-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why you are appealing these scores…"
              rows={4}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none resize-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setFormOpen(false); setReason(''); }}
                className="flex-1 py-2 border border-white/10 rounded-lg text-white/50 text-sm hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                data-testid="submit-appeal"
                type="submit"
                disabled={!reason.trim() || isLoading}
                className="flex-1 py-2 bg-yellow-500 text-black font-semibold rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Submitting…' : 'Submit Appeal'}
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  // ── Existing appeal ────────────────────────────────────────────────────────
  return (
    <div className="bg-[#0d0d1a] border border-white/10 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white mb-1">Appeal</h3>
          <p className="text-xs text-white/50 leading-relaxed">{appeal.reason}</p>
        </div>
        <span
          data-testid="appeal-status"
          className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium capitalize ${
            STATUS_STYLES[appeal.status] ?? 'bg-white/10 text-white/50'
          }`}
        >
          {appeal.status}
        </span>
      </div>

      {/* Assigned reviewer */}
      {appeal.reviewer_name && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-white/40">Assigned to:</span>
          <span data-testid="assigned-reviewer" className="text-white font-medium">
            {appeal.reviewer_name}
          </span>
        </div>
      )}

      {/* Resolution */}
      {appeal.resolution && (
        <div
          data-testid="appeal-resolution"
          className="bg-[#14F195]/10 border border-[#14F195]/20 rounded-lg p-3 text-sm text-white/80 leading-relaxed"
        >
          {appeal.resolution}
        </div>
      )}
    </div>
  );
}
