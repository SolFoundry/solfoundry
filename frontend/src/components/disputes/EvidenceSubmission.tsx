/**
 * EvidenceSubmission Component
 * 
 * Form for submitting evidence in a dispute.
 * Supports multiple evidence types: link, image, text, code, document.
 */

import React, { useState } from 'react';

type EvidenceType = 'link' | 'image' | 'text' | 'code' | 'document';

interface EvidenceItem {
  type: EvidenceType;
  url?: string;
  description: string;
}

interface EvidenceSubmissionProps {
  disputeId: string;
  userRole: 'contributor' | 'creator' | 'admin';
  onSubmitted: () => void;
}

const EVIDENCE_TYPES: { value: EvidenceType; label: string; description: string }[] = [
  { value: 'link', label: 'Link', description: 'URL to external resource' },
  { value: 'image', label: 'Image', description: 'URL to image evidence' },
  { value: 'text', label: 'Text', description: 'Written explanation' },
  { value: 'code', label: 'Code', description: 'Code snippet or gist URL' },
  { value: 'document', label: 'Document', description: 'URL to document' },
];

export function EvidenceSubmission({ disputeId, userRole, onSubmitted }: EvidenceSubmissionProps) {
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>([
    { type: 'text', description: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const addEvidenceItem = () => {
    setEvidenceItems([...evidenceItems, { type: 'text', description: '' }]);
  };

  const removeEvidenceItem = (index: number) => {
    if (evidenceItems.length > 1) {
      setEvidenceItems(evidenceItems.filter((_, i) => i !== index));
    }
  };

  const updateEvidenceItem = (index: number, field: keyof EvidenceItem, value: string) => {
    const updated = [...evidenceItems];
    updated[index] = { ...updated[index], [field]: value };
    setEvidenceItems(updated);
  };

  const validateEvidence = (): boolean => {
    for (const item of evidenceItems) {
      if (!item.description.trim()) {
        setError('Please provide a description for all evidence items');
        return false;
      }
      if ((item.type === 'link' || item.type === 'image' || item.type === 'code' || item.type === 'document') && !item.url?.trim()) {
        setError(`Please provide a URL for ${item.type} evidence`);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEvidence()) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(`/api/disputes/${disputeId}/evidence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Role': userRole,
        },
        body: JSON.stringify({
          evidence: evidenceItems.map(item => ({
            ...item,
            submitted_by: userRole,
          })),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to submit evidence');
      }

      setSuccess(true);
      setEvidenceItems([{ type: 'text', description: '' }]);
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800">Evidence submitted successfully!</p>
        </div>
      )}

      <div className="space-y-4">
        {evidenceItems.map((item, index) => (
          <div key={index} className="border border-gray-200 rounded-lg p-4 relative">
            {evidenceItems.length > 1 && (
              <button
                type="button"
                onClick={() => removeEvidenceItem(index)}
                className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Evidence Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Evidence Type
                </label>
                <select
                  value={item.type}
                  onChange={(e) => updateEvidenceItem(index, 'type', e.target.value as EvidenceType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {EVIDENCE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* URL (conditional) */}
              {['link', 'image', 'code', 'document'].includes(item.type) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL
                  </label>
                  <input
                    type="url"
                    value={item.url || ''}
                    onChange={(e) => updateEvidenceItem(index, 'url', e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              )}
            </div>

            {/* Description */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={item.description}
                onChange={(e) => updateEvidenceItem(index, 'description', e.target.value)}
                placeholder="Explain this evidence..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                {item.description.length}/2000 characters
              </p>
            </div>

            {/* Help text */}
            <p className="mt-2 text-xs text-gray-500">
              {EVIDENCE_TYPES.find(t => t.value === item.type)?.description}
            </p>
          </div>
        ))}
      </div>

      {/* Add More Evidence Button */}
      <button
        type="button"
        onClick={addEvidenceItem}
        className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Another Evidence Item
      </button>

      {/* Submit Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Submitting...' : 'Submit Evidence'}
        </button>
      </div>
    </form>
  );
}

export default EvidenceSubmission;