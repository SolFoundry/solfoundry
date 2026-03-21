import React, { useEffect, useState } from 'react';
import type { AggregatedReviewScore, ModelReviewScore } from '../../types/bounty';

const MODEL_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  gpt: { label: 'GPT-4', color: 'bg-emerald-500', icon: '🟢' },
  gemini: { label: 'Gemini', color: 'bg-blue-500', icon: '🔵' },
  grok: { label: 'Grok', color: 'bg-orange-500', icon: '🟠' },
};

const SCORE_CATEGORIES = [
  { key: 'quality_score', label: 'Quality' },
  { key: 'correctness_score', label: 'Correctness' },
  { key: 'security_score', label: 'Security' },
  { key: 'completeness_score', label: 'Completeness' },
  { key: 'test_coverage_score', label: 'Tests' },
] as const;

function ScoreBar({ value, max = 10, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-700 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono text-gray-300 w-10 text-right">
        {value.toFixed(1)}/10
      </span>
    </div>
  );
}

function ModelCard({ score }: { score: ModelReviewScore }) {
  const meta = MODEL_LABELS[score.model_name] || {
    label: score.model_name.toUpperCase(),
    color: 'bg-gray-500',
    icon: '⚪',
  };

  const isPending = score.review_status === 'pending';

  return (
    <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700/50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{meta.icon}</span>
          <span className="font-semibold text-sm text-gray-200">{meta.label}</span>
        </div>
        {isPending ? (
          <span className="text-xs text-gray-500 animate-pulse">Pending...</span>
        ) : (
          <span className="text-lg font-bold text-white">
            {score.overall_score.toFixed(1)}
          </span>
        )}
      </div>

      {!isPending && (
        <div className="space-y-2">
          {SCORE_CATEGORIES.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-24 shrink-0">{label}</span>
              <ScoreBar
                value={(score as any)[key] ?? 0}
                color={meta.color}
              />
            </div>
          ))}
          {score.review_summary && (
            <p className="text-xs text-gray-400 mt-2 border-t border-gray-700 pt-2">
              {score.review_summary}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface ReviewScoresPanelProps {
  scores: AggregatedReviewScore | null;
  loading?: boolean;
}

export const ReviewScoresPanel: React.FC<ReviewScoresPanelProps> = ({ scores, loading }) => {
  if (loading) {
    return (
      <div className="bg-gray-900 rounded-lg p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-300 mb-4">AI Review Scores</h2>
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-gray-400 text-sm">Waiting for AI reviews...</span>
        </div>
      </div>
    );
  }

  if (!scores || scores.model_scores.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-300 mb-4">AI Review Scores</h2>
        <p className="text-gray-500 text-sm text-center py-4">
          No review scores yet. Scores appear after GitHub Actions AI review completes.
        </p>
      </div>
    );
  }

  const overallColor =
    scores.overall_score >= 7 ? 'text-green-400' :
    scores.overall_score >= 5 ? 'text-yellow-400' :
    'text-red-400';

  return (
    <div className="bg-gray-900 rounded-lg p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-300">AI Review Scores</h2>
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-bold ${overallColor}`}>
            {scores.overall_score.toFixed(1)}/10
          </span>
          {scores.meets_threshold && (
            <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded-full border border-green-500/30">
              Passes
            </span>
          )}
        </div>
      </div>

      {scores.review_complete ? (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
          <span className="text-green-400 text-sm">All 3 models reviewed</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <span className="text-yellow-400 text-sm">
            {scores.model_scores.length}/3 models completed
          </span>
        </div>
      )}

      {/* Aggregate breakdown */}
      <div className="bg-gray-800/40 rounded-lg p-3 mb-4">
        <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Aggregate Breakdown</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Quality', value: scores.quality_avg },
            { label: 'Correctness', value: scores.correctness_avg },
            { label: 'Security', value: scores.security_avg },
            { label: 'Completeness', value: scores.completeness_avg },
            { label: 'Tests', value: scores.test_coverage_avg },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-sm font-bold text-white">{value.toFixed(1)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Per-model cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {scores.model_scores.map((ms) => (
          <ModelCard key={ms.model_name} score={ms} />
        ))}
      </div>
    </div>
  );
};

export default ReviewScoresPanel;
