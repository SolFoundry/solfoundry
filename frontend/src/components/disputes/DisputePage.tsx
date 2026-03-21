import React, { useState, useEffect, useCallback } from 'react';
import type {
  DisputeDetail,
  EvidenceItem,
  AuditEntry,
  DisputeState,
  DisputeOutcome,
  STATE_LABELS as StateLabelsType,
} from '../../types/dispute';
import { STATE_LABELS, OUTCOME_LABELS, DISPUTE_REASONS } from '../../types/dispute';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

const stateColors: Record<DisputeState, string> = {
  opened: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  evidence: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  mediation: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  resolved: 'bg-green-500/20 text-green-400 border-green-500/30',
};

const outcomeColors: Record<DisputeOutcome, string> = {
  release_to_contributor: 'text-green-400',
  refund_to_creator: 'text-red-400',
  split: 'text-yellow-400',
};

interface DisputePageProps {
  disputeId: string;
  currentUserId: string;
  isAdmin?: boolean;
}

export const DisputePage: React.FC<DisputePageProps> = ({
  disputeId,
  currentUserId,
  isAdmin = false,
}) => {
  const [dispute, setDispute] = useState<DisputeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [evidenceType, setEvidenceType] = useState('explanation');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [evidenceDesc, setEvidenceDesc] = useState('');

  const [resolveOutcome, setResolveOutcome] = useState('release_to_contributor');
  const [resolveNotes, setResolveNotes] = useState('');
  const [splitPct, setSplitPct] = useState(50);

  const fetchDispute = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/disputes/${disputeId}`, {
        headers: { Authorization: `Bearer ${currentUserId}` },
      });
      if (!res.ok) throw new Error('Failed to load dispute');
      setDispute(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [disputeId, currentUserId]);

  useEffect(() => {
    fetchDispute();
  }, [fetchDispute]);

  const handleSubmitEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evidenceDesc.trim()) return;
    setSubmitting(true);

    try {
      const res = await fetch(`${API_BASE}/api/disputes/${disputeId}/evidence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentUserId}`,
        },
        body: JSON.stringify({
          items: [{
            evidence_type: evidenceType,
            url: evidenceUrl || undefined,
            description: evidenceDesc,
          }],
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to submit evidence');
      }

      setEvidenceDesc('');
      setEvidenceUrl('');
      await fetchDispute();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdvanceMediation = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/disputes/${disputeId}/mediate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentUserId}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to advance to mediation');
      }
      await fetchDispute();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolveNotes.trim()) return;
    setSubmitting(true);

    try {
      const body: any = {
        outcome: resolveOutcome,
        resolution_notes: resolveNotes,
      };
      if (resolveOutcome === 'split') {
        body.split_contributor_pct = splitPct;
      }

      const res = await fetch(`${API_BASE}/api/disputes/${disputeId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentUserId}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to resolve dispute');
      }

      await fetchDispute();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-[#9945FF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !dispute) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-red-400 font-mono">{error}</p>
      </div>
    );
  }

  if (!dispute) return null;

  const isContributor = currentUserId === dispute.contributor_id;
  const isCreator = currentUserId === dispute.creator_id;
  const isParty = isContributor || isCreator;
  const canSubmitEvidence = isParty && dispute.state === 'evidence';
  const canAdvanceMediation = isParty && dispute.state === 'evidence';
  const canResolve = isAdmin && dispute.state === 'mediation';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
          {error}
          <button onClick={() => setError(null)} className="ml-4 underline">Dismiss</button>
        </div>
      )}

      {/* Header */}
      <div className="bg-[#1a1a2e] rounded-xl border border-gray-800 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Dispute</h1>
            <p className="text-sm text-gray-500 font-mono">{dispute.id}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium border ${stateColors[dispute.state]}`}>
            {STATE_LABELS[dispute.state]}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Reason</span>
            <p className="text-gray-200 mt-1">
              {DISPUTE_REASONS.find(r => r.value === dispute.reason)?.label ?? dispute.reason}
            </p>
          </div>
          <div>
            <span className="text-gray-500">Bounty</span>
            <p className="text-gray-200 mt-1 font-mono text-xs truncate">{dispute.bounty_id}</p>
          </div>
          <div>
            <span className="text-gray-500">Opened</span>
            <p className="text-gray-200 mt-1">{new Date(dispute.created_at).toLocaleDateString()}</p>
          </div>
          {dispute.evidence_deadline && dispute.state === 'evidence' && (
            <div>
              <span className="text-gray-500">Evidence Deadline</span>
              <p className="text-yellow-400 mt-1">{new Date(dispute.evidence_deadline).toLocaleDateString()}</p>
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-800">
          <p className="text-gray-300 whitespace-pre-wrap">{dispute.description}</p>
        </div>

        {/* Outcome banner */}
        {dispute.outcome && (
          <div className="mt-4 p-4 rounded-lg bg-gray-800/50 border border-gray-700">
            <div className="flex items-center gap-3">
              <span className="text-gray-400">Outcome:</span>
              <span className={`font-semibold ${outcomeColors[dispute.outcome]}`}>
                {OUTCOME_LABELS[dispute.outcome]}
              </span>
            </div>
            {dispute.resolution_notes && (
              <p className="mt-2 text-sm text-gray-400">{dispute.resolution_notes}</p>
            )}
            {dispute.ai_review_score !== null && dispute.ai_review_score !== undefined && (
              <p className="mt-2 text-sm text-gray-500">
                AI Score: <span className="text-white">{dispute.ai_review_score.toFixed(1)}/10</span>
                {dispute.mediation_type === 'ai_auto' && (
                  <span className="ml-2 text-purple-400">(Auto-resolved by AI)</span>
                )}
              </p>
            )}
            {dispute.split_contributor_pct !== null && dispute.split_contributor_pct !== undefined && (
              <p className="mt-1 text-sm text-gray-500">
                Split: Contributor {dispute.split_contributor_pct}% / Creator {dispute.split_creator_pct}%
              </p>
            )}
            {dispute.reputation_impact_applied && (
              <div className="mt-2 flex gap-4 text-xs">
                <span className={dispute.contributor_reputation_delta >= 0 ? 'text-green-400' : 'text-red-400'}>
                  Contributor rep: {dispute.contributor_reputation_delta > 0 ? '+' : ''}{dispute.contributor_reputation_delta}
                </span>
                <span className={dispute.creator_reputation_delta >= 0 ? 'text-green-400' : 'text-red-400'}>
                  Creator rep: {dispute.creator_reputation_delta > 0 ? '+' : ''}{dispute.creator_reputation_delta}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* State progress */}
      <div className="bg-[#1a1a2e] rounded-xl border border-gray-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Progress</h2>
        <div className="flex items-center gap-2">
          {(['opened', 'evidence', 'mediation', 'resolved'] as DisputeState[]).map((s, i) => {
            const states: DisputeState[] = ['opened', 'evidence', 'mediation', 'resolved'];
            const currentIdx = states.indexOf(dispute.state);
            const thisIdx = i;
            const isActive = thisIdx <= currentIdx;

            return (
              <React.Fragment key={s}>
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                  isActive ? 'bg-[#9945FF]/20 text-[#9945FF]' : 'bg-gray-800 text-gray-500'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-[#9945FF]' : 'bg-gray-600'}`} />
                  {STATE_LABELS[s]}
                </div>
                {i < 3 && (
                  <div className={`flex-1 h-px ${isActive && thisIdx < currentIdx ? 'bg-[#9945FF]' : 'bg-gray-700'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Evidence section */}
      <div className="bg-[#1a1a2e] rounded-xl border border-gray-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Evidence ({dispute.evidence.length})
        </h2>

        {dispute.evidence.length === 0 ? (
          <p className="text-gray-500 text-sm">No evidence submitted yet.</p>
        ) : (
          <div className="space-y-3">
            {dispute.evidence.map((ev) => (
              <div key={ev.id} className="p-4 rounded-lg bg-gray-800/50 border border-gray-700">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    ev.party === 'contributor'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-orange-500/20 text-orange-400'
                  }`}>
                    {ev.party}
                  </span>
                  <span className="text-xs text-gray-500">{ev.evidence_type}</span>
                  <span className="text-xs text-gray-600 ml-auto">
                    {new Date(ev.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-gray-300 text-sm">{ev.description}</p>
                {ev.url && (
                  <a
                    href={ev.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[#9945FF] hover:underline mt-1 inline-block"
                  >
                    {ev.url}
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Evidence submission form */}
        {canSubmitEvidence && (
          <form onSubmit={handleSubmitEvidence} className="mt-6 space-y-4 pt-4 border-t border-gray-700">
            <h3 className="text-sm font-medium text-gray-300">Submit Evidence</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Type</label>
                <select
                  value={evidenceType}
                  onChange={(e) => setEvidenceType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 text-sm focus:border-[#9945FF] focus:outline-none"
                >
                  <option value="explanation">Explanation</option>
                  <option value="link">Link</option>
                  <option value="screenshot">Screenshot</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">URL (optional)</label>
                <input
                  type="url"
                  value={evidenceUrl}
                  onChange={(e) => setEvidenceUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 text-sm focus:border-[#9945FF] focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Description</label>
              <textarea
                value={evidenceDesc}
                onChange={(e) => setEvidenceDesc(e.target.value)}
                rows={4}
                placeholder="Describe your evidence..."
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 text-sm focus:border-[#9945FF] focus:outline-none resize-none"
                required
                minLength={1}
              />
            </div>
            <button
              type="submit"
              disabled={submitting || !evidenceDesc.trim()}
              className="px-4 py-2 rounded-lg bg-[#9945FF] text-white text-sm font-medium hover:bg-[#8835EE] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit Evidence'}
            </button>
          </form>
        )}

        {/* Advance to mediation */}
        {canAdvanceMediation && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <button
              onClick={handleAdvanceMediation}
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Processing...' : 'Submit for Mediation'}
            </button>
            <p className="text-xs text-gray-500 mt-2">
              This will trigger AI review. If the AI score is 7+/10, the dispute resolves automatically.
            </p>
          </div>
        )}
      </div>

      {/* Admin resolve panel */}
      {canResolve && (
        <div className="bg-[#1a1a2e] rounded-xl border border-yellow-500/30 p-6">
          <h2 className="text-lg font-semibold text-yellow-400 mb-4">Admin Resolution</h2>

          {dispute.ai_review_score !== null && dispute.ai_review_score !== undefined && (
            <div className="mb-4 p-3 rounded-lg bg-gray-800/50">
              <p className="text-sm text-gray-400">
                AI Score: <span className="text-white font-bold">{dispute.ai_review_score.toFixed(1)}/10</span>
              </p>
              {dispute.ai_review_summary && (
                <p className="text-xs text-gray-500 mt-1">{dispute.ai_review_summary}</p>
              )}
            </div>
          )}

          <form onSubmit={handleResolve} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Outcome</label>
              <select
                value={resolveOutcome}
                onChange={(e) => setResolveOutcome(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 text-sm focus:border-yellow-500 focus:outline-none"
              >
                <option value="release_to_contributor">Release to Contributor</option>
                <option value="refund_to_creator">Refund to Creator</option>
                <option value="split">Split</option>
              </select>
            </div>

            {resolveOutcome === 'split' && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Contributor Share: {splitPct}%
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={splitPct}
                  onChange={(e) => setSplitPct(Number(e.target.value))}
                  className="w-full accent-[#9945FF]"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Contributor: {splitPct}%</span>
                  <span>Creator: {100 - splitPct}%</span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs text-gray-500 mb-1">Resolution Notes</label>
              <textarea
                value={resolveNotes}
                onChange={(e) => setResolveNotes(e.target.value)}
                rows={3}
                placeholder="Explain the resolution decision..."
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 text-sm focus:border-yellow-500 focus:outline-none resize-none"
                required
                minLength={1}
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !resolveNotes.trim()}
              className="px-4 py-2 rounded-lg bg-yellow-500 text-black text-sm font-bold hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Resolving...' : 'Resolve Dispute'}
            </button>
          </form>
        </div>
      )}

      {/* Audit trail */}
      <div className="bg-[#1a1a2e] rounded-xl border border-gray-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Audit Trail ({dispute.audit_trail.length})
        </h2>
        {dispute.audit_trail.length === 0 ? (
          <p className="text-gray-500 text-sm">No audit entries yet.</p>
        ) : (
          <div className="space-y-2">
            {dispute.audit_trail.map((entry) => (
              <div key={entry.id} className="flex items-start gap-3 text-sm py-2 border-b border-gray-800 last:border-0">
                <div className="w-2 h-2 rounded-full bg-[#9945FF] mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-gray-300 font-medium">{entry.action.replace(/_/g, ' ')}</span>
                    {entry.new_state && (
                      <span className="text-xs text-gray-500">
                        {entry.previous_state && `${entry.previous_state} → `}{entry.new_state}
                      </span>
                    )}
                  </div>
                  {entry.notes && (
                    <p className="text-gray-500 text-xs mt-0.5 truncate">{entry.notes}</p>
                  )}
                </div>
                <span className="text-xs text-gray-600 shrink-0">
                  {new Date(entry.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DisputePage;
