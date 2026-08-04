import React from 'react';
import { motion } from 'framer-motion';
import { Brain, Clock, Star } from 'lucide-react';
import type { LLMReviewScore, LLMProvider } from '../../types/review';

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const PROVIDER_META: Record<LLMProvider, { label: string; color: string; gradient: string }> = {
  claude: { label: 'Claude', color: 'text-purple-light', gradient: 'from-purple to-purple-light' },
  codex: { label: 'Codex', color: 'text-emerald', gradient: 'from-emerald to-emerald-light' },
  gemini: { label: 'Gemini', color: 'text-status-info', gradient: 'from-status-info to-blue-400' },
};

interface ReviewScoreCardProps {
  review: LLMReviewScore;
  index: number;
  onExpand?: (id: string) => void;
  expanded?: boolean;
}

export function ReviewScoreCard({ review, index, onExpand, expanded }: ReviewScoreCardProps) {
  const meta = PROVIDER_META[review.provider] ?? PROVIDER_META.claude;
  const scorePercent = (review.score / review.max_score) * 100;

  return (
    <motion.div
      variants={fadeIn}
      initial="initial"
      animate="animate"
      transition={{ delay: index * 0.1 }}
      className="rounded-xl border border-border bg-forge-900 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${meta.gradient} flex items-center justify-center`}>
            <Brain className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-sans text-sm font-semibold text-text-primary">{meta.label}</p>
            <p className="text-xs text-text-muted">
              <Clock className="w-3 h-3 inline mr-1" />
              {new Date(review.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className={`font-mono text-2xl font-bold ${meta.color}`}>
            {review.score.toFixed(1)}
          </p>
          <p className="text-xs text-text-muted">/ {review.max_score}</p>
        </div>
      </div>

      {/* Score bar */}
      <div className="px-4 py-3">
        <div className="h-2 rounded-full bg-forge-800 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${scorePercent}%` }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 + index * 0.1 }}
            className={`h-full rounded-full bg-gradient-to-r ${meta.gradient}`}
          />
        </div>
      </div>

      {/* Criteria scores */}
      <div className="px-4 pb-3 space-y-1.5">
        {review.criteria_scores.map((criterion) => {
          const critPercent = (criterion.score / criterion.max_score) * 100;
          return (
            <div key={criterion.name} className="flex items-center gap-2">
              <span className="text-xs text-text-muted w-24 truncate flex-shrink-0">{criterion.name}</span>
              <div className="flex-1 h-1.5 rounded-full bg-forge-800 overflow-hidden">
                <div
                  className={`h-full rounded-full ${meta.color.replace('text-', 'bg-')}/60`}
                  style={{ width: `${critPercent}%` }}
                />
              </div>
              <span className="text-xs font-mono text-text-muted w-10 text-right">
                {criterion.score.toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Reasoning toggle */}
      {onExpand && (
        <button
          onClick={() => onExpand(review.id)}
          className="w-full px-4 py-2 text-xs text-text-muted hover:text-text-secondary bg-forge-800/50 border-t border-border/30 transition-colors duration-150"
        >
          {expanded ? 'Hide reasoning' : 'Show reasoning'}
        </button>
      )}

      {/* Expanded reasoning */}
      {expanded && (
        <div className="px-4 py-3 border-t border-border/30 bg-forge-850">
          <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">{review.reasoning}</p>
          {review.strengths.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-emerald mb-1">Strengths</p>
              <ul className="space-y-0.5">
                {review.strengths.map((s, i) => (
                  <li key={i} className="text-xs text-text-muted flex items-start gap-1">
                    <Star className="w-3 h-3 text-emerald mt-0.5 flex-shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {review.weaknesses.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-status-warning mb-1">Weaknesses</p>
              <ul className="space-y-0.5">
                {review.weaknesses.map((w, i) => (
                  <li key={i} className="text-xs text-text-muted flex items-start gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-status-warning mt-1 flex-shrink-0" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}