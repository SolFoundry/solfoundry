/**
 * DisputePage Component
 * 
 * Full dispute details view with evidence submission and resolution.
 * 
 * States:
 * - OPENED: Initial state, contributor can add evidence
 * - EVIDENCE: Both parties submitting evidence
 * - MEDIATION: Under review (AI or manual)
 * - RESOLVED: Final decision made
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { EvidenceSubmission } from './EvidenceSubmission';
import { DisputeTimeline } from './DisputeTimeline';
import type { DisputeHistoryItem } from '../../types/dispute';

interface Evidence {
  type: string;
  url?: string;
  description: string;
  submitted_at: string;
  submitted_by: string;
}

interface Dispute {
  id: string;
  bounty_id: string;
  submission_id: string;
  contributor_id: string;
  creator_id: string;
  reason: string;
  description: string;
  state: 'OPENED' | 'EVIDENCE' | 'MEDIATION' | 'RESOLVED';
  outcome?: 'release_to_contributor' | 'refund_to_creator' | 'split';
  contributor_evidence: Evidence[];
  creator_evidence: Evidence[];
  ai_review_score?: number;
  ai_review_notes?: string;
  auto_resolved: boolean;
  resolver_id?: string;
  resolution_notes?: string;
  creator_reputation_penalty: number;
  contributor_reputation_penalty: number;
  created_at: string;
  evidence_deadline?: string;
  updated_at: string;
  resolved_at?: string;
  history: DisputeHistoryItem[];
}

const STATE_COLORS = {
  OPENED: 'bg-yellow-100 text-yellow-800',
  EVIDENCE: 'bg-blue-100 text-blue-800',
  MEDIATION: 'bg-purple-100 text-purple-800',
  RESOLVED: 'bg-green-100 text-green-800',
};

const OUTCOME_LABELS = {
  release_to_contributor: 'Released to Contributor',
  refund_to_creator: 'Refunded to Creator',
  split: 'Split Between Parties',
};

const OUTCOME_COLORS = {
  release_to_contributor: 'bg-green-100 text-green-800',
  refund_to_creator: 'bg-red-100 text-red-800',
  split: 'bg-yellow-100 text-yellow-800',
};

const REASON_LABELS: Record<string, string> = {
  incorrect_review: 'Incorrect Review',
  met_requirements: 'Requirements Met',
  unfair_rejection: 'Unfair Rejection',
  misunderstanding: 'Misunderstanding',
  technical_issue: 'Technical Issue',
  other: 'Other',
};

export function DisputePage() {
  const { disputeId } = useParams<{ disputeId: string }>();
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'contributor' | 'creator' | 'admin' | null>(null);

  useEffect(() => {
    fetchDispute();
  }, [disputeId]);

  const fetchDispute = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/disputes/${disputeId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch dispute');
      }
      const data = await response.json();
      setDispute(data);
      
      // Determine user role based on wallet/address
      // In production, this would check against the authenticated user
      const storedWallet = localStorage.getItem('walletAddress');
      if (data.contributor_id === storedWallet) {
        setUserRole('contributor');
      } else if (data.creator_id === storedWallet) {
        setUserRole('creator');
      } else {
        setUserRole('admin');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleEvidenceSubmitted = () => {
    fetchDispute();
  };

  const handleTransitionToMediation = async () => {
    try {
      const response = await fetch(`/api/disputes/${disputeId}/mediate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error('Failed to transition to mediation');
      }
      fetchDispute();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !dispute) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error || 'Dispute not found'}</p>
        </div>
      </div>
    );
  }

  const canSubmitEvidence = 
    (dispute.state === 'OPENED' || dispute.state === 'EVIDENCE') &&
    dispute.evidence_deadline &&
    new Date(dispute.evidence_deadline) > new Date();

  const canTransitionToMediation = 
    dispute.state !== 'RESOLVED' && 
    dispute.state !== 'MEDIATION' &&
    (userRole === 'contributor' || userRole === 'admin');

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Dispute Resolution</h1>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATE_COLORS[dispute.state]}`}>
            {dispute.state}
          </span>
          {dispute.outcome && (
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${OUTCOME_COLORS[dispute.outcome]}`}>
              {OUTCOME_LABELS[dispute.outcome]}
            </span>
          )}
        </div>
        <p className="text-gray-500">
          Created {new Date(dispute.created_at).toLocaleDateString()} at{' '}
          {new Date(dispute.created_at).toLocaleTimeString()}
        </p>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Dispute Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Dispute Details</h2>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-500">Reason</label>
                <p className="mt-1 text-gray-900">{REASON_LABELS[dispute.reason] || dispute.reason}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Bounty ID</label>
                <p className="mt-1 text-gray-900 font-mono text-sm truncate">{dispute.bounty_id}</p>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-500">Description</label>
                <p className="mt-1 text-gray-900 whitespace-pre-wrap">{dispute.description}</p>
              </div>
            </div>

            {dispute.evidence_deadline && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800">
                  <span className="font-medium">Evidence Deadline:</span>{' '}
                  {new Date(dispute.evidence_deadline).toLocaleDateString()} at{' '}
                  {new Date(dispute.evidence_deadline).toLocaleTimeString()}
                </p>
              </div>
            )}
          </div>

          {/* AI Review */}
          {dispute.ai_review_score !== null && dispute.ai_review_score !== undefined && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">AI Mediation Analysis</h2>
              
              <div className="flex items-center gap-4 mb-4">
                <div className="text-4xl font-bold text-indigo-600">
                  {dispute.ai_review_score.toFixed(1)}
                </div>
                <div>
                  <div className="text-sm text-gray-500">AI Score</div>
                  <div className="text-xs text-gray-400">Threshold: 7.0</div>
                </div>
                {dispute.ai_review_score >= 7.0 ? (
                  <span className="ml-auto px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                    Auto-Resolve Threshold Met
                  </span>
                ) : (
                  <span className="ml-auto px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
                    Manual Review Required
                  </span>
                )}
              </div>

              {dispute.ai_review_notes && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
                    {dispute.ai_review_notes}
                  </pre>
                </div>
              )}

              {dispute.auto_resolved && (
                <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-green-800">
                    ✓ This dispute was automatically resolved by AI mediation.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Resolution */}
          {dispute.state === 'RESOLVED' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Resolution</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500">Outcome</label>
                  <p className="mt-1 text-gray-900 font-medium">
                    {dispute.outcome && OUTCOME_LABELS[dispute.outcome]}
                  </p>
                </div>

                {dispute.resolution_notes && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Resolution Notes</label>
                    <p className="mt-1 text-gray-900 whitespace-pre-wrap">{dispute.resolution_notes}</p>
                  </div>
                )}

                {dispute.resolved_at && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Resolved At</label>
                    <p className="mt-1 text-gray-900">
                      {new Date(dispute.resolved_at).toLocaleDateString()} at{' '}
                      {new Date(dispute.resolved_at).toLocaleTimeString()}
                    </p>
                  </div>
                )}

                {(dispute.creator_reputation_penalty > 0 || dispute.contributor_reputation_penalty > 0) && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h3 className="font-medium text-yellow-800 mb-2">Reputation Impact</h3>
                    {dispute.creator_reputation_penalty > 0 && (
                      <p className="text-yellow-700">
                        Creator penalty: -{dispute.creator_reputation_penalty} reputation points
                      </p>
                    )}
                    {dispute.contributor_reputation_penalty > 0 && (
                      <p className="text-yellow-700">
                        Contributor penalty: -{dispute.contributor_reputation_penalty} reputation points
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Evidence Submission */}
          {canSubmitEvidence && userRole && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Submit Evidence</h2>
              <EvidenceSubmission
                disputeId={dispute.id}
                userRole={userRole}
                onSubmitted={handleEvidenceSubmitted}
              />
            </div>
          )}

          {/* Transition to Mediation */}
          {canTransitionToMediation && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Request Mediation</h2>
              <p className="text-gray-600 mb-4">
                Transition this dispute to mediation. This will trigger AI review and potentially
                auto-resolution if the score is ≥ 7/10.
              </p>
              <button
                onClick={handleTransitionToMediation}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Start Mediation
              </button>
            </div>
          )}
        </div>

        {/* Right Column - Evidence & Timeline */}
        <div className="space-y-6">
          {/* Contributor Evidence */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Contributor Evidence</h2>
            {dispute.contributor_evidence.length === 0 ? (
              <p className="text-gray-500 italic">No evidence submitted yet</p>
            ) : (
              <ul className="space-y-3">
                {dispute.contributor_evidence.map((evidence, index) => (
                  <li key={index} className="border-l-2 border-blue-200 pl-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                        {evidence.type}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(evidence.submitted_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{evidence.description}</p>
                    {evidence.url && (
                      <a
                        href={evidence.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline"
                      >
                        View Evidence →
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Creator Evidence */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Creator Evidence</h2>
            {dispute.creator_evidence.length === 0 ? (
              <p className="text-gray-500 italic">No evidence submitted yet</p>
            ) : (
              <ul className="space-y-3">
                {dispute.creator_evidence.map((evidence, index) => (
                  <li key={index} className="border-l-2 border-orange-200 pl-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded">
                        {evidence.type}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(evidence.submitted_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{evidence.description}</p>
                    {evidence.url && (
                      <a
                        href={evidence.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline"
                      >
                        View Evidence →
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">History</h2>
            <DisputeTimeline history={dispute.history} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default DisputePage;