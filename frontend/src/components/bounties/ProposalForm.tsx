/**
 * ProposalForm -- free-form proposal submission for T3 bounties.
 * Shows only when the bounty is T3 and open.
 */
import React, { useState } from 'react';
import { getAuthToken } from '../../services/apiClient';

interface ProposalFormProps {
  bountyId: string;
  onSubmitted: () => void;
}

export function ProposalForm({ bountyId, onSubmitted }: ProposalFormProps) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim().length < 20) {
      setError('Proposal must be at least 20 characters.');
      return;
    }
    setSubmitting(true);
    setError('');

    try {
      const token = getAuthToken();
      const res = await fetch(`/api/bounties/${bountyId}/proposals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ proposal_text: text }),
      });
      if (res.ok) {
        setSuccess(true);
        setText('');
        onSubmitted();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || 'Failed to submit proposal.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="bg-green-900/20 border border-green-800 rounded-lg p-4 text-center">
        <p className="text-green-400 font-medium">Proposal submitted</p>
        <p className="text-sm text-gray-400 mt-1">The bounty creator will review your proposal.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Your Proposal
        </label>
        <p className="text-xs text-gray-500 mb-2">
          Describe your approach, relevant experience, timeline, and why you are the right person for this bounty.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          maxLength={5000}
          placeholder="I would approach this by..."
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm focus:border-purple-500 focus:outline-none resize-y"
        />
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-500">{text.length}/5000</span>
          {text.length > 0 && text.length < 20 && (
            <span className="text-xs text-orange-400">Min 20 characters</span>
          )}
        </div>
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={submitting || text.trim().length < 20}
        className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors min-h-[44px]"
      >
        {submitting ? 'Submitting...' : 'Submit Proposal'}
      </button>
    </form>
  );
}
