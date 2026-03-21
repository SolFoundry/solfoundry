/**
 * DisputeEvidenceForm — Form for submitting evidence to a dispute.
 *
 * Allows participants to add evidence items (links, descriptions)
 * with optional notes. Only shown to dispute participants when the
 * dispute is in OPENED or EVIDENCE state.
 * @module components/disputes/DisputeEvidenceForm
 */

import React, { useState } from 'react';
import type { EvidenceItem, DisputeEvidencePayload } from '../../types/dispute';

/** Props for the DisputeEvidenceForm component. */
export interface DisputeEvidenceFormProps {
  /** Callback when evidence is submitted. */
  onSubmit: (payload: DisputeEvidencePayload) => Promise<unknown>;
  /** Whether the form is currently submitting. */
  loading: boolean;
  /** Whether the dispute is in a state that accepts evidence. */
  disabled?: boolean;
}

/** Initial state for a single evidence item in the form. */
const EMPTY_EVIDENCE_ITEM: EvidenceItem = {
  evidence_type: 'link',
  url: '',
  description: '',
};

/**
 * Form component for submitting dispute evidence.
 *
 * Supports adding multiple evidence items, each with a type, URL,
 * and description. Validates that at least one item is filled before
 * allowing submission.
 */
export const DisputeEvidenceForm: React.FC<DisputeEvidenceFormProps> = ({
  onSubmit,
  loading,
  disabled = false,
}) => {
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>([
    { ...EMPTY_EVIDENCE_ITEM },
  ]);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const handleAddItem = () => {
    setEvidenceItems((previous) => [...previous, { ...EMPTY_EVIDENCE_ITEM }]);
  };

  const handleRemoveItem = (index: number) => {
    setEvidenceItems((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleItemChange = (
    index: number,
    field: keyof EvidenceItem,
    value: string,
  ) => {
    setEvidenceItems((previous) =>
      previous.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    // Validate: at least one evidence item with a description
    const validItems = evidenceItems.filter(
      (item) => item.description.trim().length > 0,
    );
    if (validItems.length === 0) {
      setFormError('Please provide at least one evidence item with a description.');
      return;
    }

    const payload: DisputeEvidencePayload = {
      evidence_links: validItems,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };

    await onSubmit(payload);

    // Reset form on success
    setEvidenceItems([{ ...EMPTY_EVIDENCE_ITEM }]);
    setNotes('');
  };

  return (
    <div className="bg-gray-900 rounded-lg p-4 sm:p-6" data-testid="evidence-form">
      <h3 className="text-lg font-semibold text-gray-300 mb-4">
        Submit Evidence
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        {evidenceItems.map((item, index) => (
          <div
            key={index}
            className="bg-gray-800/50 rounded-lg p-4 space-y-3"
            data-testid={`evidence-item-${index}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-400">
                Evidence #{index + 1}
              </span>
              {evidenceItems.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveItem(index)}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  aria-label={`Remove evidence item ${index + 1}`}
                >
                  Remove
                </button>
              )}
            </div>

            <div>
              <label
                htmlFor={`evidence-type-${index}`}
                className="block text-xs text-gray-500 mb-1"
              >
                Type
              </label>
              <select
                id={`evidence-type-${index}`}
                value={item.evidence_type}
                onChange={(event) =>
                  handleItemChange(index, 'evidence_type', event.target.value)
                }
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-[#9945FF] focus:outline-none"
                disabled={disabled}
              >
                <option value="link">Link</option>
                <option value="screenshot">Screenshot</option>
                <option value="code">Code Reference</option>
                <option value="document">Document</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label
                htmlFor={`evidence-url-${index}`}
                className="block text-xs text-gray-500 mb-1"
              >
                URL (optional)
              </label>
              <input
                id={`evidence-url-${index}`}
                type="url"
                value={item.url || ''}
                onChange={(event) =>
                  handleItemChange(index, 'url', event.target.value)
                }
                placeholder="https://..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#9945FF] focus:outline-none"
                disabled={disabled}
              />
            </div>

            <div>
              <label
                htmlFor={`evidence-desc-${index}`}
                className="block text-xs text-gray-500 mb-1"
              >
                Description
              </label>
              <textarea
                id={`evidence-desc-${index}`}
                value={item.description}
                onChange={(event) =>
                  handleItemChange(index, 'description', event.target.value)
                }
                placeholder="Describe this evidence..."
                rows={2}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#9945FF] focus:outline-none resize-none"
                disabled={disabled}
              />
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={handleAddItem}
          className="text-sm text-[#9945FF] hover:text-[#7C3AED] transition-colors"
          disabled={disabled}
        >
          + Add Another Evidence Item
        </button>

        <div>
          <label htmlFor="evidence-notes" className="block text-xs text-gray-500 mb-1">
            Additional Notes (optional)
          </label>
          <textarea
            id="evidence-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Any additional context..."
            rows={3}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#9945FF] focus:outline-none resize-none"
            disabled={disabled}
          />
        </div>

        {formError && (
          <p className="text-sm text-red-400" role="alert">
            {formError}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || disabled}
          className="w-full px-4 py-3 bg-[#9945FF] hover:bg-[#7C3AED] disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-medium transition-colors min-h-[44px]"
        >
          {loading ? 'Submitting...' : 'Submit Evidence'}
        </button>
      </form>
    </div>
  );
};

export default DisputeEvidenceForm;
