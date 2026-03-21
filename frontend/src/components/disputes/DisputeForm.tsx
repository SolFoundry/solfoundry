/**
 * DisputeForm Component
 * 
 * Form for creating a new dispute for a rejected submission.
 * Must be submitted within 72 hours of rejection.
 */

import React, { useState } from 'react';

interface EvidenceItem {
  type: string;
  url?: string;
  description: string;
}

interface DisputeFormData {
  bounty_id: string;
  submission_id: string;
  reason: string;
  description: string;
  initial_evidence: EvidenceItem[];
}

interface DisputeFormProps {
  bountyId: string;
  submissionId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const DISPUTE_REASONS = [
  { value: 'incorrect_review', label: 'Incorrect Review', description: 'The reviewer made an error in evaluating my work' },
  { value: 'met_requirements', label: 'Requirements Met', description: 'My submission met all the stated requirements' },
  { value: 'unfair_rejection', label: 'Unfair Rejection', description: 'The rejection was unfair or biased' },
  { value: 'misunderstanding', label: 'Misunderstanding', description: 'There was a misunderstanding about the requirements' },
  { value: 'technical_issue', label: 'Technical Issue', description: 'A technical issue affected the review process' },
  { value: 'other', label: 'Other', description: 'Other reason not listed above' },
];

export function DisputeForm({ bountyId, submissionId, onSuccess, onCancel }: DisputeFormProps) {
  const [formData, setFormData] = useState<DisputeFormData>({
    bounty_id: bountyId,
    submission_id: submissionId,
    reason: '',
    description: '',
    initial_evidence: [],
  });
  const [showEvidenceForm, setShowEvidenceForm] = useState(false);
  const [currentEvidence, setCurrentEvidence] = useState<EvidenceItem>({
    type: 'text',
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (field: keyof DisputeFormData, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleEvidenceChange = (field: keyof EvidenceItem, value: string) => {
    setCurrentEvidence({ ...currentEvidence, [field]: value });
  };

  const addEvidence = () => {
    if (!currentEvidence.description.trim()) {
      return;
    }
    if (['link', 'image', 'code', 'document'].includes(currentEvidence.type) && !currentEvidence.url?.trim()) {
      return;
    }
    setFormData({
      ...formData,
      initial_evidence: [...formData.initial_evidence, { ...currentEvidence }],
    });
    setCurrentEvidence({ type: 'text', description: '' });
    setShowEvidenceForm(false);
  };

  const removeEvidence = (index: number) => {
    setFormData({
      ...formData,
      initial_evidence: formData.initial_evidence.filter((_, i) => i !== index),
    });
  };

  const validateForm = (): boolean => {
    if (!formData.reason) {
      setError('Please select a reason for the dispute');
      return false;
    }
    if (formData.description.length < 10) {
      setError('Description must be at least 10 characters');
      return false;
    }
    if (formData.description.length > 5000) {
      setError('Description must be less than 5000 characters');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/disputes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to create dispute');
      }

      onSuccess();
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

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-1">Dispute Deadline</h3>
        <p className="text-sm text-blue-800">
          You must file a dispute within 72 hours of rejection. After that, the rejection is final.
        </p>
      </div>

      {/* Reason Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Reason for Dispute <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {DISPUTE_REASONS.map((reason) => (
            <label
              key={reason.value}
              className={`relative flex cursor-pointer rounded-lg border p-4 ${
                formData.reason === reason.value
                  ? 'border-indigo-600 bg-indigo-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="reason"
                value={reason.value}
                checked={formData.reason === reason.value}
                onChange={(e) => handleInputChange('reason', e.target.value)}
                className="sr-only"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900">{reason.label}</div>
                <div className="text-sm text-gray-500">{reason.description}</div>
              </div>
              {formData.reason === reason.value && (
                <div className="absolute top-4 right-4 text-indigo-600">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </label>
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Detailed Explanation <span className="text-red-500">*</span>
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => handleInputChange('description', e.target.value)}
          placeholder="Explain why you believe the rejection was unfair..."
          rows={6}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          required
        />
        <p className="mt-1 text-xs text-gray-500">
          {formData.description.length}/5000 characters (minimum 10)
        </p>
      </div>

      {/* Evidence Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Supporting Evidence (Optional)
          </label>
          {!showEvidenceForm && (
            <button
              type="button"
              onClick={() => setShowEvidenceForm(true)}
              className="text-sm text-indigo-600 hover:text-indigo-700"
            >
              + Add Evidence
            </button>
          )}
        </div>

        {/* Evidence List */}
        {formData.initial_evidence.length > 0 && (
          <div className="space-y-2 mb-4">
            {formData.initial_evidence.map((evidence, index) => (
              <div key={index} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
                  {evidence.type}
                </span>
                <span className="flex-1 text-sm text-gray-700 truncate">
                  {evidence.description}
                </span>
                <button
                  type="button"
                  onClick={() => removeEvidence(index)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add Evidence Form */}
        {showEvidenceForm && (
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                <select
                  value={currentEvidence.type}
                  onChange={(e) => handleEvidenceChange('type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="text">Text</option>
                  <option value="link">Link</option>
                  <option value="image">Image</option>
                  <option value="code">Code</option>
                  <option value="document">Document</option>
                </select>
              </div>
              {['link', 'image', 'code', 'document'].includes(currentEvidence.type) && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">URL</label>
                  <input
                    type="url"
                    value={currentEvidence.url || ''}
                    onChange={(e) => handleEvidenceChange('url', e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <textarea
                value={currentEvidence.description}
                onChange={(e) => handleEvidenceChange('description', e.target.value)}
                placeholder="Describe this evidence..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowEvidenceForm(false);
                  setCurrentEvidence({ type: 'text', description: '' });
                }}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addEvidence}
                className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
              >
                Add Evidence
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 hover:text-gray-900"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Submitting...' : 'Submit Dispute'}
        </button>
      </div>
    </form>
  );
}

export default DisputeForm;