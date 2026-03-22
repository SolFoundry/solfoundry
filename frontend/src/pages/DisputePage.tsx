/**
 * DisputePage — Full dispute detail view with timeline, evidence, and resolution.
 *
 * Route: /disputes/:id
 *
 * Fetches the dispute detail by ID and renders:
 * - Status header with outcome information
 * - Evidence list with submission form (for participants)
 * - Dispute timeline (audit history)
 * - Admin resolution panel (for admins)
 *
 * Auth-aware: shows evidence form only to participants, resolution
 * panel only to admins.
 * @module pages/DisputePage
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useDispute } from '../hooks/useDispute';
import { DisputeTimeline } from '../components/disputes/DisputeTimeline';
import { DisputeEvidenceForm } from '../components/disputes/DisputeEvidenceForm';
import { DisputeResolutionPanel } from '../components/disputes/DisputeResolutionPanel';
import {
  DISPUTE_STATUS_LABELS,
  DISPUTE_OUTCOME_LABELS,
  DISPUTE_REASON_LABELS,
} from '../types/dispute';
import type {
  DisputeStatus,
  DisputeOutcome,
  DisputeReason,
  DisputeEvidencePayload,
  DisputeResolvePayload,
  EvidenceItem,
} from '../types/dispute';

/** Status badge colors. */
const STATUS_COLORS: Record<string, string> = {
  opened:
    'bg-yellow-500/20 text-yellow-800 border-yellow-500/40 dark:text-yellow-400 dark:border-yellow-500/30',
  evidence:
    'bg-blue-500/20 text-blue-800 border-blue-500/40 dark:text-blue-400 dark:border-blue-500/30',
  mediation:
    'bg-purple-500/20 text-purple-800 border-purple-500/40 dark:text-purple-400 dark:border-purple-500/30',
  resolved:
    'bg-green-500/20 text-green-800 border-green-500/40 dark:text-green-400 dark:border-green-500/30',
};

/** Loading skeleton for the dispute page. */
function DisputePageSkeleton() {
  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 animate-pulse">
      <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-64 mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-gray-200 dark:bg-gray-900 rounded-lg p-6 h-48" />
          <div className="bg-gray-200 dark:bg-gray-900 rounded-lg p-6 h-64" />
          <div className="bg-gray-200 dark:bg-gray-900 rounded-lg p-6 h-96" />
        </div>
        <div className="space-y-4">
          <div className="bg-gray-200 dark:bg-gray-900 rounded-lg p-6 h-48" />
          <div className="bg-gray-200 dark:bg-gray-900 rounded-lg p-6 h-64" />
        </div>
      </div>
    </div>
  );
}

/**
 * Main dispute detail page component.
 *
 * Fetches and displays full dispute information including history,
 * evidence, and resolution state. Provides interactive forms for
 * evidence submission and admin resolution.
 */
export default function DisputePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    disputeDetail,
    loading,
    error,
    fetchDisputeDetail,
    submitEvidence,
    requestMediation,
    resolveDispute,
    clearError,
  } = useDispute();

  const [pageError, setPageError] = useState<string | null>(null);

  // Determine current user context
  const currentUserId = localStorage.getItem('user_id') || '';
  const isAdmin = localStorage.getItem('is_admin') === 'true';

  const loadDispute = useCallback(async () => {
    if (!id) return;
    setPageError(null);
    const result = await fetchDisputeDetail(id);
    if (!result) {
      setPageError('Failed to load dispute details.');
    }
  }, [id, fetchDisputeDetail]);

  useEffect(() => {
    loadDispute();
  }, [loadDispute]);

  const handleSubmitEvidence = async (payload: DisputeEvidencePayload) => {
    if (!id) return;
    clearError();
    const result = await submitEvidence(id, payload);
    if (result) {
      await loadDispute();
    }
  };

  const handleMediate = async () => {
    if (!id) return;
    clearError();
    const result = await requestMediation(id);
    if (result) {
      await loadDispute();
    }
  };

  const handleResolve = async (payload: DisputeResolvePayload) => {
    if (!id) return;
    clearError();
    const result = await resolveDispute(id, payload);
    if (result) {
      await loadDispute();
    }
  };

  // Loading state
  if (loading && !disputeDetail) {
    return <DisputePageSkeleton />;
  }

  // Error state
  if (pageError || (error && !disputeDetail)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-gray-600 dark:text-gray-400 font-mono">{pageError || error}</p>
        <button
          onClick={() => navigate('/disputes')}
          className="px-4 py-2 rounded-lg bg-[#9945FF]/20 text-[#9945FF] hover:bg-[#9945FF]/30 transition-colors"
        >
          Back to Disputes
        </button>
      </div>
    );
  }

  if (!disputeDetail) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-gray-600 dark:text-gray-400 font-mono">Dispute not found</p>
        <button
          onClick={() => navigate('/disputes')}
          className="px-4 py-2 rounded-lg bg-[#9945FF]/20 text-[#9945FF] hover:bg-[#9945FF]/30 transition-colors"
        >
          Back to Disputes
        </button>
      </div>
    );
  }

  const dispute = disputeDetail;
  const isParticipant = currentUserId === dispute.contributor_id || currentUserId === dispute.creator_id;
  const canSubmitEvidence = isParticipant && ['opened', 'evidence'].includes(dispute.status);
  const statusColor =
    STATUS_COLORS[dispute.status] ||
    'bg-gray-500/20 text-gray-800 border-gray-500/40 dark:text-gray-400 dark:border-gray-500/30';
  const reasonLabel = DISPUTE_REASON_LABELS[dispute.reason as DisputeReason] || dispute.reason;
  const statusLabel = DISPUTE_STATUS_LABELS[dispute.status as DisputeStatus] || dispute.status;

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
        <Link to="/disputes" className="hover:text-gray-900 dark:hover:text-white transition-colors">
          Disputes
        </Link>
        <span>/</span>
        <span className="text-gray-900 dark:text-white font-mono">{dispute.id.slice(0, 8)}...</span>
      </nav>

      {/* Error Banner */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header Card */}
          <div className="bg-white dark:bg-gray-900 rounded-lg p-4 sm:p-6 border border-gray-200 dark:border-transparent shadow-sm dark:shadow-none">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColor}`}
              >
                {statusLabel}
              </span>
              {dispute.outcome && (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                  {DISPUTE_OUTCOME_LABELS[dispute.outcome as DisputeOutcome] || dispute.outcome}
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-3">
              Dispute: {reasonLabel}
            </h1>

            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mb-4">
              {dispute.description}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs text-gray-600 dark:text-gray-400">
              <div>
                <span className="block text-gray-500 mb-1">Bounty</span>
                <Link
                  to={`/bounties/${dispute.bounty_id}`}
                  className="text-[#9945FF] hover:text-[#7C3AED] font-mono"
                >
                  {dispute.bounty_id.slice(0, 12)}...
                </Link>
              </div>
              <div>
                <span className="block text-gray-500 mb-1">Filed</span>
                {new Date(dispute.created_at).toLocaleDateString()}
              </div>
              <div>
                <span className="block text-gray-500 mb-1">Rejected At</span>
                {new Date(dispute.rejection_timestamp).toLocaleDateString()}
              </div>
            </div>
          </div>

          {/* Evidence Section */}
          <div className="bg-white dark:bg-gray-900 rounded-lg p-4 sm:p-6 border border-gray-200 dark:border-transparent shadow-sm dark:shadow-none">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-300 mb-4">
              Evidence ({(dispute.evidence_links || []).length} items)
            </h3>
            {dispute.evidence_links && dispute.evidence_links.length > 0 ? (
              <div className="space-y-3">
                {dispute.evidence_links.map((item: EvidenceItem, index: number) => (
                  <div
                    key={index}
                    className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 flex items-start gap-3 border border-gray-100 dark:border-transparent"
                  >
                    <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs text-gray-800 dark:text-gray-300 flex-shrink-0">
                      {item.evidence_type}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800 dark:text-gray-300">{item.description}</p>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#9945FF] hover:text-[#7C3AED] break-all mt-1 block"
                        >
                          {item.url}
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 dark:text-gray-500 text-sm">No evidence submitted yet.</p>
            )}
          </div>

          {/* Evidence Submission Form */}
          {canSubmitEvidence && (
            <DisputeEvidenceForm
              onSubmit={handleSubmitEvidence}
              loading={loading}
              disabled={false}
            />
          )}

          {/* Timeline */}
          <DisputeTimeline history={dispute.history} />
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Status Card */}
          <div className="bg-white dark:bg-gray-900 rounded-lg p-4 sm:p-6 sticky top-4 space-y-4 border border-gray-200 dark:border-transparent shadow-sm dark:shadow-none">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-300">Dispute Info</h3>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className="text-gray-900 dark:text-white font-medium">{statusLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Reason</span>
                <span className="text-gray-900 dark:text-white">{reasonLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Contributor</span>
                <span className="text-gray-900 dark:text-white font-mono text-xs">
                  {dispute.contributor_id.slice(0, 8)}...
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Creator</span>
                <span className="text-gray-900 dark:text-white font-mono text-xs">
                  {dispute.creator_id.slice(0, 8)}...
                </span>
              </div>
              {dispute.ai_review_score !== null && dispute.ai_review_score !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-500">AI Score</span>
                  <span className={`font-bold ${dispute.ai_review_score >= 7 ? 'text-green-400' : 'text-yellow-400'}`}>
                    {dispute.ai_review_score.toFixed(1)}/10
                  </span>
                </div>
              )}
              {dispute.outcome && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Outcome</span>
                  <span className="text-[#14F195] font-medium">
                    {DISPUTE_OUTCOME_LABELS[dispute.outcome as DisputeOutcome] || dispute.outcome}
                  </span>
                </div>
              )}
            </div>

            {/* Reputation Impacts */}
            {dispute.status === 'resolved' && (
              <div className="pt-3 border-t border-gray-200 dark:border-gray-800 space-y-2">
                <h4 className="text-xs font-medium text-gray-500 uppercase">Reputation Impact</h4>
                {dispute.reputation_impact_creator !== null && dispute.reputation_impact_creator !== undefined && dispute.reputation_impact_creator !== 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Creator</span>
                    <span className={dispute.reputation_impact_creator < 0 ? 'text-red-400' : 'text-green-400'}>
                      {dispute.reputation_impact_creator > 0 ? '+' : ''}{dispute.reputation_impact_creator}
                    </span>
                  </div>
                )}
                {dispute.reputation_impact_contributor !== null && dispute.reputation_impact_contributor !== undefined && dispute.reputation_impact_contributor !== 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Contributor</span>
                    <span className={dispute.reputation_impact_contributor < 0 ? 'text-red-400' : 'text-green-400'}>
                      {dispute.reputation_impact_contributor > 0 ? '+' : ''}{dispute.reputation_impact_contributor}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Admin Resolution Panel */}
          <DisputeResolutionPanel
            dispute={dispute}
            onResolve={handleResolve}
            onMediate={handleMediate}
            loading={loading}
            isAdmin={isAdmin}
          />
        </div>
      </div>
    </div>
  );
}
