import React, { useState } from 'react';
import type { EvidenceSubmission } from '../../types/dispute';

interface EvidenceItem {
  evidence_type: string;
  url: string;
  description: string;
}

const BLANK_ITEM: EvidenceItem = { evidence_type: 'link', url: '', description: '' };

interface Props {
  onSubmit: (payload: EvidenceSubmission) => Promise<void> | void;
  loading: boolean;
}

export function DisputeEvidenceForm({ onSubmit, loading }: Props) {
  const [items, setItems] = useState<EvidenceItem[]>([{ ...BLANK_ITEM }]);
  const [error, setError] = useState<string | null>(null);

  function updateItem(index: number, field: keyof EvidenceItem, value: string) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function addItem() {
    setItems((prev) => [...prev, { ...BLANK_ITEM }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const hasDescription = items.some((item) => item.description.trim().length > 0);
    if (!hasDescription) {
      setError('Please provide at least one evidence item with a description.');
      return;
    }

    await onSubmit({ evidence_links: items });
  }

  return (
    <form data-testid="evidence-form" onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div role="alert" className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {items.map((item, index) => (
        <div
          key={index}
          data-testid={`evidence-item-${index}`}
          className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/50 font-medium">Evidence #{index + 1}</span>
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Remove
              </button>
            )}
          </div>

          <select
            value={item.evidence_type}
            onChange={(e) => updateItem(index, 'evidence_type', e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
          >
            <option value="link">Link</option>
            <option value="screenshot">Screenshot</option>
            <option value="code">Code Snippet</option>
            <option value="other">Other</option>
          </select>

          <input
            type="url"
            value={item.url}
            onChange={(e) => updateItem(index, 'url', e.target.value)}
            placeholder="https://..."
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
          />

          <textarea
            value={item.description}
            onChange={(e) => updateItem(index, 'description', e.target.value)}
            placeholder="Describe this evidence..."
            rows={3}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none resize-none"
          />
        </div>
      ))}

      <button
        type="button"
        onClick={addItem}
        className="text-sm text-[#14F195] hover:underline"
      >
        + Add Another Evidence Item
      </button>

      <div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-[#14F195] text-black font-semibold rounded-xl text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Submitting...' : 'Submit Evidence'}
        </button>
      </div>
    </form>
  );
}
