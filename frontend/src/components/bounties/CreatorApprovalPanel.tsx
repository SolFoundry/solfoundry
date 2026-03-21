import React, { useState } from 'react';
import type { BountySubmission, AggregatedReviewScore } from '../../types/bounty';

interface CreatorApprovalPanelProps {
  submissions: BountySubmission[];
  reviewScores: Record<string, AggregatedReviewScore>;
  onApprove: (submissionId: string) => Promise<unknown>;
  onDispute: (submissionId: string, reason: string) => Promise<unknown>;
  onFetchReview: (submissionId: string) => Promise<unknown>;
  loading?: boolean;
  isCreator: boolean;
}

const statusBadge: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  approved: 'bg-green-500/20 text-green-400 border-green-500/30',
  disputed: 'bg-red-500/20 text-red-400 border-red-500/30',
  paid: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  rejected: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 7 ? 'text-green-400' : score >= 5 ? 'text-yellow-400' : 'text-red-400';
  return <span className={`font-bold ${color}`}>{score.toFixed(1)}/10</span>;
}

export const CreatorApprovalPanel: React.FC<CreatorApprovalPanelProps> = ({
  submissions,
  reviewScores,
  onApprove,
  onDispute,
  onFetchReview,
  loading,
  isCreator,
}) => {
  const [disputeTarget, setDisputeTarget] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [confirmApprove, setConfirmApprove] = useState<string | null>(null);

  if (submissions.length === 0) {
    return null;
  }

  const handleApprove = async (subId: string) => {
    await onApprove(subId);
    setConfirmApprove(null);
  };

  const handleDispute = async (subId: string) => {
    if (disputeReason.length < 5) return;
    await onDispute(subId, disputeReason);
    setDisputeTarget(null);
    setDisputeReason('');
  };

  return (
    <div className="bg-gray-900 rounded-lg p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-gray-300 mb-4">
        Submissions ({submissions.length})
      </h2>

      <div className="space-y-4">
        {submissions.map((sub) => {
          const review = reviewScores[sub.id];
          const modelScores = sub.ai_scores_by_model || {};
          const hasScores = Object.keys(modelScores).length > 0;

          return (
            <div
              key={sub.id}
              className="bg-gray-800/60 rounded-lg p-4 border border-gray-700/50"
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#9945FF]/30 flex items-center justify-center text-sm font-bold text-[#9945FF]">
                    {sub.submitted_by.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <a
                      href={sub.pr_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline text-sm font-medium"
                    >
                      {sub.pr_url.replace('https://github.com/', '')}
                    </a>
                    <p className="text-xs text-gray-500">
                      Submitted {formatDate(sub.submitted_at)}
                      {sub.contributor_wallet && (
                        <> · <code className="text-gray-600">{sub.contributor_wallet.slice(0, 8)}...</code></>
                      )}
                    </p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusBadge[sub.status] || statusBadge.pending}`}>
                  {sub.status.toUpperCase()}
                  {sub.winner && ' (Winner)'}
                </span>
              </div>

              {/* AI Scores summary */}
              {hasScores && (
                <div className="flex flex-wrap items-center gap-3 mb-3 text-sm">
                  <span className="text-gray-400">AI Score:</span>
                  <ScoreBadge score={sub.ai_score} />
                  <span className="text-gray-600">|</span>
                  {Object.entries(modelScores).map(([model, score]) => (
                    <span key={model} className="text-xs text-gray-400">
                      {model.toUpperCase()}: {(score as number).toFixed(1)}
                    </span>
                  ))}
                  {sub.meets_threshold && (
                    <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">
                      Passes threshold
                    </span>
                  )}
                  <button
                    onClick={() => onFetchReview(sub.id)}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    View details
                  </button>
                </div>
              )}

              {/* Auto-approve timer */}
              {sub.auto_approve_eligible && sub.auto_approve_after && sub.status === 'pending' && (
                <div className="mb-3 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-400">
                  Auto-approves after {formatDate(sub.auto_approve_after)} if no dispute
                </div>
              )}

              {/* Payout info */}
              {sub.payout_tx_hash && (
                <div className="mb-3 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-emerald-400">Paid {sub.payout_amount?.toLocaleString()} FNDRY</span>
                    <a
                      href={`https://solscan.io/tx/${sub.payout_tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      View tx
                    </a>
                  </div>
                  <code className="text-xs text-gray-500 font-mono block mt-1 truncate">
                    {sub.payout_tx_hash}
                  </code>
                </div>
              )}

              {/* Creator actions */}
              {isCreator && sub.status === 'pending' && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-700/50">
                  {confirmApprove === sub.id ? (
                    <div className="flex items-center gap-2 w-full">
                      <span className="text-sm text-yellow-400">Confirm approval? This will release FNDRY.</span>
                      <button
                        onClick={() => handleApprove(sub.id)}
                        disabled={loading}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors min-h-[36px]"
                      >
                        {loading ? 'Processing...' : 'Confirm'}
                      </button>
                      <button
                        onClick={() => setConfirmApprove(null)}
                        className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors min-h-[36px]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : disputeTarget === sub.id ? (
                    <div className="w-full space-y-2">
                      <textarea
                        value={disputeReason}
                        onChange={(e) => setDisputeReason(e.target.value)}
                        placeholder="Explain why you're disputing this submission (min 5 characters)..."
                        rows={2}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDispute(sub.id)}
                          disabled={loading || disputeReason.length < 5}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white text-sm rounded-lg transition-colors min-h-[36px]"
                        >
                          Submit Dispute
                        </button>
                        <button
                          onClick={() => { setDisputeTarget(null); setDisputeReason(''); }}
                          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors min-h-[36px]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setConfirmApprove(sub.id)}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors min-h-[36px]"
                      >
                        Approve & Pay
                      </button>
                      <button
                        onClick={() => setDisputeTarget(sub.id)}
                        className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm rounded-lg transition-colors border border-red-600/30 min-h-[36px]"
                      >
                        Dispute
                      </button>
                    </>
                  )}
                </div>
              )}

              {sub.notes && (
                <p className="text-xs text-gray-500 mt-2">{sub.notes}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CreatorApprovalPanel;
