/**
 * ReviewScorePanel — visualises multi-LLM review scores with consensus indicator.
 */
import React from 'react';
import { useReviewScores } from '../../hooks/useReviewScores';
import type { ReviewScore } from '../../hooks/useReviewScores';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REVIEWER_META: Record<string, { label: string; color: string; bg: string }> = {
  claude: { label: 'Claude',  color: '#14F195', bg: 'bg-[#14F195]/10 border-[#14F195]/20' },
  codex:  { label: 'Codex',   color: '#60a5fa', bg: 'bg-blue-500/10 border-blue-500/20' },
  gemini: { label: 'Gemini',  color: '#f59e0b', bg: 'bg-yellow-500/10 border-yellow-500/20' },
};

function scoreColor(score: number): string {
  if (score >= 8) return 'text-[#14F195]';
  if (score >= 6) return 'text-yellow-400';
  return 'text-red-400';
}

function consensus(scores: ReviewScore[]): { isConsensus: boolean; spread: number; avg: number } {
  if (!scores.length) return { isConsensus: true, spread: 0, avg: 0 };
  const vals = scores.map((s) => s.score);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const spread = Math.max(...vals) - Math.min(...vals);
  return { isConsensus: spread <= 1.5, spread, avg };
}

// ---------------------------------------------------------------------------
// ScoreCard
// ---------------------------------------------------------------------------

function ScoreCard({ score }: { score: ReviewScore }) {
  const meta = REVIEWER_META[score.reviewer] ?? { label: score.reviewer, color: '#ffffff', bg: 'bg-white/5 border-white/10' };

  return (
    <div className={`border rounded-xl p-4 ${meta.bg}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-white">{meta.label}</p>
          <p className="text-xs text-white/40 font-mono mt-0.5">{score.model_id}</p>
        </div>
        <span
          data-testid={`score-${score.reviewer}`}
          className={`text-2xl font-bold ${scoreColor(score.score)}`}
        >
          {score.score}
        </span>
      </div>

      {/* Score bar */}
      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-3">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${score.score * 10}%`, backgroundColor: meta.color }}
        />
      </div>

      {/* Reasoning */}
      <p className="text-xs text-white/60 leading-relaxed">{score.reasoning}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReviewScorePanel
// ---------------------------------------------------------------------------

interface Props {
  submissionId: string;
}

export function ReviewScorePanel({ submissionId }: Props) {
  const { scores, isLoading, error } = useReviewScores(submissionId);
  const { isConsensus, spread, avg } = consensus(scores);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse bg-white/5 rounded-xl h-6 w-40" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="animate-pulse bg-white/5 rounded-xl h-36" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
        {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">Review Scores</h2>

        <div className="flex items-center gap-3">
          {/* Average */}
          {scores.length > 0 && (
            <span
              data-testid="average-score"
              className={`text-sm font-bold ${scoreColor(avg)}`}
            >
              Avg {avg.toFixed(2)}
            </span>
          )}

          {/* Consensus indicator */}
          {scores.length > 0 && (
            <span
              data-testid="consensus-indicator"
              className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                isConsensus
                  ? 'bg-[#14F195]/20 text-[#14F195]'
                  : 'bg-red-500/20 text-red-400'
              }`}
            >
              {isConsensus ? 'Consensus' : `Disagreement (Δ${spread.toFixed(1)})`}
            </span>
          )}
        </div>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {scores.map((s) => (
          <ScoreCard key={s.reviewer} score={s} />
        ))}
      </div>
    </div>
  );
}
