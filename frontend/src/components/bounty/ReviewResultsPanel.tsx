import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Brain, CheckCircle2, AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';
import { listSubmissions } from '../../api/bounties';
import type { Submission } from '../../types/bounty';

interface Props {
  bountyId: string;
}

const MODEL_LABELS: Record<string, string> = {
  claude: 'Claude',
  codex: 'Codex',
  gemini: 'Gemini',
  gpt: 'GPT',
  grok: 'Grok',
};

function prettyModelName(name: string): string {
  const normalized = name.toLowerCase();
  return MODEL_LABELS[normalized] ?? name.charAt(0).toUpperCase() + name.slice(1);
}

function scoreColor(score: number): string {
  if (score >= 8) return 'text-emerald';
  if (score >= 6.5) return 'text-status-warning';
  return 'text-status-error';
}

function confidenceFromScores(scores: number[]): number {
  if (!scores.length) return 0;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((sum, s) => sum + (s - avg) ** 2, 0) / scores.length;
  const stdDev = Math.sqrt(variance);
  const confidence = Math.max(35, Math.min(99, Math.round(100 - stdDev * 18)));
  return confidence;
}

function ReviewCard({ submission }: { submission: Submission }) {
  const scoreMap = submission.ai_scores_by_model ?? {};
  const scoreEntries = Object.entries(scoreMap);
  const scores = scoreEntries.map(([, score]) => Number(score)).filter((n) => !Number.isNaN(n));
  const aggregate = submission.ai_score ?? submission.review_score ?? (scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null);
  const confidence = submission.confidence_percentage ?? confidenceFromScores(scores);
  const passed = submission.meets_threshold ?? ((aggregate ?? 0) >= 7);

  return (
    <div className="rounded-xl border border-border bg-forge-900 p-5" data-testid={`review-card-${submission.id}`}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-sm font-medium text-text-primary">
            {submission.contributor_username ? `@${submission.contributor_username}` : 'Submission'}
          </p>
          <p className="text-xs text-text-muted mt-1">AI review results</p>
        </div>
        <div className="text-right">
          <p className={`font-mono text-2xl font-bold ${scoreColor(aggregate ?? 0)}`}>{aggregate?.toFixed(1) ?? '—'}</p>
          <p className="text-xs text-text-muted">aggregate score</p>
        </div>
      </div>

      {scoreEntries.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {scoreEntries.map(([model, score]) => (
            <div key={model} className="rounded-lg border border-border bg-forge-800 px-3 py-3" data-testid={`model-score-${model}`}>
              <div className="flex items-center gap-2 text-xs text-text-muted mb-1">
                <Brain className="w-3.5 h-3.5" /> {prettyModelName(model)}
              </div>
              <div className={`font-mono text-lg font-semibold ${scoreColor(Number(score))}`}>{Number(score).toFixed(1)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="rounded-lg border border-border bg-forge-800 px-3 py-3">
          <p className="text-xs text-text-muted mb-1">Confidence</p>
          <p className="font-mono text-lg font-semibold text-text-primary">{confidence}%</p>
        </div>
        <div className="rounded-lg border border-border bg-forge-800 px-3 py-3">
          <p className="text-xs text-text-muted mb-1">Quality</p>
          <p className={`font-medium ${passed ? 'text-emerald' : 'text-status-error'}`}>{passed ? 'Pass threshold' : 'Needs work'}</p>
        </div>
        <div className="rounded-lg border border-border bg-forge-800 px-3 py-3">
          <p className="text-xs text-text-muted mb-1">Review status</p>
          <p className="font-medium text-text-primary">{submission.review_complete ? 'Complete' : 'Pending'}</p>
        </div>
      </div>

      {(submission.review_reasoning || submission.description) && (
        <div className="rounded-lg border border-border bg-forge-800 px-4 py-3 mb-3">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Suggested improvements</p>
          <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
            {submission.review_reasoning ?? submission.description}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-4 text-sm">
        <div className="inline-flex items-center gap-2 text-text-muted">
          {passed ? <CheckCircle2 className="w-4 h-4 text-emerald" /> : <AlertTriangle className="w-4 h-4 text-status-warning" />}
          {passed ? 'Ready for approval' : 'Review details available'}
        </div>
        {(submission.review_details_url || submission.pr_url) && (
          <a
            href={submission.review_details_url ?? submission.pr_url ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-emerald hover:text-emerald-light transition-colors"
          >
            Full review details <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

export function ReviewResultsPanel({ bountyId }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['submissions', bountyId],
    queryFn: () => listSubmissions(bountyId),
    staleTime: 30_000,
  });

  const reviewed = (data ?? []).filter((s) => (s.ai_score ?? s.review_score ?? 0) > 0 || (s.ai_scores_by_model && Object.keys(s.ai_scores_by_model).length > 0));

  return (
    <div className="rounded-xl border border-border bg-forge-900 p-6" data-testid="review-results-panel">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="font-sans text-lg font-semibold text-text-primary">LLM Review Results</h2>
          <p className="text-sm text-text-muted mt-1">Claude, Codex, and Gemini scores with quality and confidence indicators.</p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-text-muted py-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading review results…
        </div>
      )}

      {isError && !isLoading && (
        <div className="text-sm text-status-error bg-status-error/10 border border-status-error/20 rounded-lg px-4 py-3">
          Could not load review results right now.
        </div>
      )}

      {!isLoading && !isError && reviewed.length === 0 && (
        <div className="text-sm text-text-muted bg-forge-800 border border-border rounded-lg px-4 py-4">
          No completed LLM review results yet. Once submissions are reviewed, scores and reasoning will appear here.
        </div>
      )}

      {!isLoading && !isError && reviewed.length > 0 && (
        <div className="space-y-4">
          {reviewed.map((submission) => (
            <ReviewCard key={submission.id} submission={submission} />
          ))}
        </div>
      )}
    </div>
  );
}
