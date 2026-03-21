import React, { useState } from 'react';
import { DISPUTE_REASONS } from '../../types/dispute';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

interface DisputeCreateFormProps {
  bountyId: string;
  submissionId: string;
  currentUserId: string;
  onCreated: (disputeId: string) => void;
  onCancel: () => void;
}

export const DisputeCreateForm: React.FC<DisputeCreateFormProps> = ({
  bountyId,
  submissionId,
  currentUserId,
  onCreated,
  onCancel,
}) => {
  const [reason, setReason] = useState(DISPUTE_REASONS[0].value);
  const [description, setDescription] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [evidenceDesc, setEvidenceDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (description.length < 10) {
      setError('Description must be at least 10 characters');
      return;
    }

    setSubmitting(true);
    setError(null);

    const evidence = [];
    if (evidenceDesc.trim()) {
      evidence.push({
        evidence_type: evidenceUrl ? 'link' : 'explanation',
        url: evidenceUrl || undefined,
        description: evidenceDesc,
      });
    }

    try {
      const res = await fetch(`${API_BASE}/api/disputes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentUserId}`,
        },
        body: JSON.stringify({
          bounty_id: bountyId,
          submission_id: submissionId,
          reason,
          description,
          evidence,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to create dispute');
      }

      const dispute = await res.json();
      onCreated(dispute.id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-[#1a1a2e] rounded-xl border border-red-500/30 p-6">
      <h2 className="text-xl font-bold text-white mb-2">Dispute Rejection</h2>
      <p className="text-sm text-gray-400 mb-6">
        You have 72 hours from the rejection to file a dispute.
        Both you and the bounty creator will be able to submit evidence.
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Reason for Dispute</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 text-sm focus:border-[#9945FF] focus:outline-none"
          >
            {DISPUTE_REASONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">
            Description <span className="text-gray-600">(min 10 chars)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            placeholder="Explain why you believe this rejection was unfair..."
            className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 text-sm focus:border-[#9945FF] focus:outline-none resize-none"
            required
            minLength={10}
          />
          <span className="text-xs text-gray-600">{description.length}/5000</span>
        </div>

        <div className="border-t border-gray-700 pt-4">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Initial Evidence (optional)</h3>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Supporting URL</label>
            <input
              type="url"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              placeholder="https://github.com/..."
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 text-sm focus:border-[#9945FF] focus:outline-none"
            />
          </div>
          <div className="mt-3">
            <label className="block text-xs text-gray-500 mb-1">Evidence Description</label>
            <textarea
              value={evidenceDesc}
              onChange={(e) => setEvidenceDesc(e.target.value)}
              rows={2}
              placeholder="Describe what this evidence shows..."
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 text-sm focus:border-[#9945FF] focus:outline-none resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting || description.length < 10}
            className="px-6 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Filing Dispute...' : 'File Dispute'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default DisputeCreateForm;
