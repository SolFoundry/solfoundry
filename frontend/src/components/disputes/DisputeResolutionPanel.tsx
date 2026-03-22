/**
 * DisputeResolutionPanel — Admin panel for resolving disputes.
 *
 * Allows administrators to select an outcome (release_to_contributor,
 * refund_to_creator, or split) and provide resolution notes. Includes
 * a button to trigger AI mediation first.
 * @module components/disputes/DisputeResolutionPanel
 */

import React, { useState } from 'react';
import type { DisputeResolvePayload, DisputeOutcome, DisputeDetail } from '../../types/dispute';
import { DISPUTE_OUTCOME_LABELS } from '../../types/dispute';

/** Resolution outcomes available to admins. */
const RESOLUTION_OPTIONS: { value: DisputeOutcome; label: string; description: string }[] = [
  {
    value: 'release_to_contributor',
    label: DISPUTE_OUTCOME_LABELS.release_to_contributor,
    description: 'Contributor was right. Release escrowed funds and penalize creator reputation.',
  },
  {
    value: 'refund_to_creator',
    label: DISPUTE_OUTCOME_LABELS.refund_to_creator,
    description: 'Rejection was valid. Refund creator and penalize contributor reputation.',
  },
  {
    value: 'split',
    label: DISPUTE_OUTCOME_LABELS.split,
    description: 'Shared fault. Split funds and apply partial penalties to both sides.',
  },
];

/** Props for the DisputeResolutionPanel component. */
export interface DisputeResolutionPanelProps {
  /** The dispute being resolved. */
  dispute: DisputeDetail;
  /** Callback for admin resolution. */
  onResolve: (payload: DisputeResolvePayload) => Promise<unknown>;
  /** Callback to trigger AI mediation. */
  onMediate: () => Promise<unknown>;
  /** Whether an operation is in progress. */
  loading: boolean;
  /** Whether the current user is an admin. */
  isAdmin: boolean;
}

/**
 * Admin panel for resolving disputes.
 *
 * Only shown to admin users when the dispute is in a resolvable state.
 * Provides outcome selection, resolution notes input, and a mediation
 * trigger button.
 */
export const DisputeResolutionPanel: React.FC<DisputeResolutionPanelProps> = ({
  dispute,
  onResolve,
  onMediate,
  loading,
  isAdmin,
}) => {
  const [selectedOutcome, setSelectedOutcome] = useState<DisputeOutcome>('release_to_contributor');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const canMediate = dispute.status === 'evidence';
  const canResolve = dispute.status === 'mediation';
  const isResolved = dispute.status === 'resolved';

  if (!isAdmin) {
    return null;
  }

  const handleResolve = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    if (!resolutionNotes.trim()) {
      setFormError('Resolution notes are required.');
      return;
    }

    const payload: DisputeResolvePayload = {
      outcome: selectedOutcome,
      resolution_notes: resolutionNotes.trim(),
    };

    await onResolve(payload);
  };

  const handleMediate = async () => {
    await onMediate();
  };

  return (
    <div
      className="bg-gray-900 rounded-lg p-4 sm:p-6 border border-[#9945FF]/30"
      data-testid="resolution-panel"
    >
      <h3 className="text-lg font-semibold text-[#9945FF] mb-4">
        Admin Resolution Panel
      </h3>

      {/* AI Mediation Info */}
      {dispute.ai_review_score !== null && dispute.ai_review_score !== undefined && (
        <div className="mb-4 p-3 bg-gray-800/50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-300">AI Mediation Score</span>
            <span
              className={`text-lg font-bold ${
                dispute.ai_review_score >= 7.0 ? 'text-green-400' : 'text-yellow-400'
              }`}
            >
              {dispute.ai_review_score.toFixed(1)}/10
            </span>
          </div>
          {dispute.ai_recommendation && (
            <p className="text-xs text-gray-400">{dispute.ai_recommendation}</p>
          )}
        </div>
      )}

      {/* Mediation Trigger */}
      {canMediate && (
        <button
          type="button"
          onClick={handleMediate}
          disabled={loading}
          className="w-full mb-4 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 text-white rounded-lg font-medium transition-colors min-h-[44px]"
        >
          {loading ? 'Running AI Mediation...' : 'Trigger AI Mediation'}
        </button>
      )}

      {/* Resolution Form */}
      {canResolve && (
        <form onSubmit={handleResolve} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Resolution Outcome
            </label>
            <div className="space-y-2">
              {RESOLUTION_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedOutcome === option.value
                      ? 'border-[#9945FF] bg-[#9945FF]/10'
                      : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="outcome"
                    value={option.value}
                    checked={selectedOutcome === option.value}
                    onChange={() => setSelectedOutcome(option.value)}
                    className="mt-1 accent-[#9945FF]"
                  />
                  <div>
                    <span className="text-sm font-medium text-white">{option.label}</span>
                    <p className="text-xs text-gray-400 mt-0.5">{option.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="resolution-notes" className="block text-sm font-medium text-gray-300 mb-1">
              Resolution Notes
            </label>
            <textarea
              id="resolution-notes"
              value={resolutionNotes}
              onChange={(event) => setResolutionNotes(event.target.value)}
              placeholder="Explain the rationale for this decision..."
              rows={4}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#9945FF] focus:outline-none resize-none"
            />
          </div>

          {formError && (
            <p className="text-sm text-red-400" role="alert">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-3 bg-[#14F195] hover:bg-[#10D080] disabled:bg-gray-700 text-black font-bold rounded-lg transition-colors min-h-[44px]"
          >
            {loading ? 'Resolving...' : 'Resolve Dispute'}
          </button>
        </form>
      )}

      {/* Resolved State */}
      {isResolved && (
        <div className="p-4 bg-gray-800/50 rounded-lg">
          <p className="text-sm text-gray-300 mb-2">
            <span className="font-medium">Outcome:</span>{' '}
            {dispute.outcome
              ? DISPUTE_OUTCOME_LABELS[dispute.outcome] || dispute.outcome
              : 'N/A'}
          </p>
          {dispute.resolution_notes && (
            <p className="text-sm text-gray-400">
              <span className="font-medium text-gray-300">Notes:</span>{' '}
              {dispute.resolution_notes}
            </p>
          )}
          {dispute.resolver_id && (
            <p className="text-xs text-gray-500 mt-2">
              Resolved by {dispute.resolver_id.slice(0, 8)}...
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default DisputeResolutionPanel;
