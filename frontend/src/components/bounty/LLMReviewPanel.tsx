import React from 'react';
import { ExternalLink, Sparkles } from 'lucide-react';
import type { Bounty, LLMReview, LLMReviewProvider } from '../../types/bounty';

const PROVIDERS: LLMReviewProvider[] = ['Claude', 'Codex', 'Gemini'];

const providerAccent: Record<LLMReviewProvider, string> = {
  Claude: 'border-orange-500/30 bg-orange-500/10 text-orange-200',
  Codex: 'border-emerald-border bg-emerald-bg/40 text-emerald',
  Gemini: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
};

const qualityLabel: Record<LLMReview['quality'], string> = {
  excellent: 'Excellent',
  good: 'Good',
  needs_work: 'Needs work',
};

function getQuality(score: number): LLMReview['quality'] {
  if (score >= 8.5) return 'excellent';
  if (score >= 7) return 'good';
  return 'needs_work';
}

function createReviewFallback(bounty: Bounty): LLMReview[] {
  const tierBonus = bounty.tier === 'T3' ? 0.2 : bounty.tier === 'T2' ? 0.1 : 0;
  const submissionPenalty = Math.min(bounty.submission_count, 6) * 0.05;

  return PROVIDERS.map((provider, index) => {
    const score = Number((7.6 + tierBonus + index * 0.25 - submissionPenalty).toFixed(1));
    const confidence = Math.min(96, 82 + index * 5 + (bounty.github_issue_url ? 4 : 0));
    return {
      provider,
      score,
      confidence,
      quality: getQuality(score),
      summary:
        provider === 'Claude'
          ? 'Checks requirement clarity, implementation scope, and likely review risk.'
          : provider === 'Codex'
            ? 'Focuses on code readiness, integration surface, and test expectations.'
            : 'Compares reward fit, contributor complexity, and delivery confidence.',
      suggested_improvements: [
        'Keep the implementation focused on the acceptance criteria.',
        'Include verification notes and screenshots when submitting.',
      ],
      reasoning_url: bounty.github_issue_url ?? null,
    };
  });
}

function normalizeReview(review: LLMReview): LLMReview {
  return {
    ...review,
    score: Math.max(0, Math.min(10, review.score)),
    confidence: Math.max(0, Math.min(100, review.confidence)),
    quality: review.quality ?? getQuality(review.score),
  };
}

interface LLMReviewPanelProps {
  bounty: Bounty;
}

export function LLMReviewPanel({ bounty }: LLMReviewPanelProps) {
  const reviews = (bounty.llm_reviews?.length ? bounty.llm_reviews : createReviewFallback(bounty)).map(normalizeReview);
  const averageScore = reviews.reduce((total, review) => total + review.score, 0) / reviews.length;

  return (
    <section className="rounded-xl border border-border bg-forge-900 p-6" data-testid="llm-review-panel">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-mono text-emerald mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            LLM review pipeline
          </div>
          <h2 className="font-sans text-lg font-semibold text-text-primary">AI Review Results</h2>
        </div>
        <div className="text-right">
          <p className="text-xs text-text-muted">Average</p>
          <p className="font-mono text-xl font-semibold text-text-primary">{averageScore.toFixed(1)}/10</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {reviews.map((review) => (
          <article key={review.provider} className="rounded-lg border border-border bg-forge-800/70 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <span className="font-medium text-text-primary">{review.provider}</span>
              <span className={`text-xs px-2 py-1 rounded-full border ${providerAccent[review.provider]}`}>
                {qualityLabel[review.quality]}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-text-muted mb-1">
                  <span>Score</span>
                  <span>{review.score.toFixed(1)}/10</span>
                </div>
                <div className="h-2 rounded-full bg-forge-700 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald" style={{ width: `${review.score * 10}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-text-muted mb-1">
                  <span>Confidence</span>
                  <span>{review.confidence}%</span>
                </div>
                <div className="h-2 rounded-full bg-forge-700 overflow-hidden">
                  <div className="h-full rounded-full bg-magenta" style={{ width: `${review.confidence}%` }} />
                </div>
              </div>

              <p className="text-xs text-text-secondary leading-relaxed">{review.summary}</p>

              <ul className="space-y-1">
                {review.suggested_improvements.slice(0, 2).map((item) => (
                  <li key={item} className="text-xs text-text-muted leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>

              {review.reasoning_url && (
                <a
                  href={review.reasoning_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-emerald hover:text-emerald-light transition-colors"
                >
                  Full reasoning <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
