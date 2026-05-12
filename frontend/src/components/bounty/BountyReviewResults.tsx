import React from 'react';
import { ExternalLink } from 'lucide-react';
import type { Bounty } from '../../types/bounty';
import { useBountyReviews } from '../../hooks/useReviews';

const qualityStyle = {
  strong: 'text-emerald bg-emerald-bg border-emerald/30',
  good: 'text-status-info bg-status-info/10 border-status-info/30',
  'needs-work': 'text-status-warning bg-status-warning/10 border-status-warning/30',
};

export function BountyReviewResults({ bounty }: { bounty: Bounty }) {
  const { data } = useBountyReviews(bounty.id);
  const items = data?.items ?? [];

  if (!items.length) return null;

  return (
    <div className="rounded-xl border border-border bg-forge-900 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-sans text-lg font-semibold text-text-primary">LLM Review Results</h2>
        <span className="text-xs text-text-muted font-mono">auto-refresh 30s</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {items.map((r) => (
          <div key={r.model} className="rounded-lg border border-border bg-forge-850 p-4">
            <p className="text-sm font-semibold text-text-primary mb-2">{r.model}</p>
            <p className="font-mono text-2xl text-emerald mb-2">{r.score.toFixed(1)} / 10</p>
            <p className="text-xs text-text-muted mb-2">Confidence: {r.confidence}%</p>
            <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full border ${qualityStyle[r.quality]}`}>
              {r.quality}
            </span>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {items.map((r) => (
          <div key={`${r.model}-summary`} className="text-sm text-text-secondary">
            <span className="font-medium text-text-primary">{r.model}:</span> {r.summary}{' '}
            {r.detail_url && (
              <a href={r.detail_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald hover:text-emerald-light">
                full reasoning <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
