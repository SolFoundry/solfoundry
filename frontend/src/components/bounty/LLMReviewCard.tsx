import React from 'react';
import { motion } from 'framer-motion';
import { Brain, ChevronDown, ChevronUp, ThumbsUp, Lightbulb, ExternalLink } from 'lucide-react';
import type { LLMReviewScore, BountyReview } from '../../types/bounty';
import { staggerContainer, staggerItem, fadeIn } from '../../lib/animations';

const LLM_LOGOS: Record<string, { label: string; color: string; bg: string }> = {
  Claude: { label: 'Claude', color: 'text-orange-400', bg: 'bg-orange-400/10' },
  Codex: { label: 'Codex', color: 'text-green-400', bg: 'bg-green-400/10' },
  Gemini: { label: 'Gemini', color: 'text-blue-400', bg: 'bg-blue-400/10' },
};

const QUALITY_COLORS: Record<string, string> = {
  excellent: 'text-emerald',
  good: 'text-blue-400',
  average: 'text-yellow-400',
  poor: 'text-red-400',
};

function ScoreBar({ score, maxScore }: { score: number; maxScore: number }) {
  const pct = (score / maxScore) * 100;
  const barColor =
    pct >= 80 ? 'bg-emerald' : pct >= 60 ? 'bg-blue-400' : pct >= 40 ? 'bg-yellow-400' : 'bg-red-400';
  return (
    <div className="w-full h-2 rounded-full bg-forge-800 overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className={`h-full rounded-full ${barColor}`}
      />
    </div>
  );
}

function LLMScoreCard({ score }: { score: LLMReviewScore }) {
  const [expanded, setExpanded] = React.useState(false);
  const meta = LLM_LOGOS[score.llm_name] ?? { label: score.llm_name, color: 'text-text-primary', bg: 'bg-forge-800' };

  return (
    <motion.div
      variants={staggerItem}
      className="rounded-xl border border-border bg-forge-900 p-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg ${meta.bg} flex items-center justify-center`}>
            <Brain className={`w-4 h-4 ${meta.color}`} />
          </div>
          <div>
            <span className={`font-semibold text-sm ${meta.color}`}>{meta.label}</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs text-text-muted">Confidence</span>
              <span className="text-xs font-mono text-text-primary">{Math.round(score.confidence * 100)}%</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <span className={`font-mono text-2xl font-bold ${QUALITY_COLORS[score.quality]}`}>
            {score.score.toFixed(1)}
          </span>
          <span className="text-text-muted text-xs font-mono">/{score.max_score}</span>
        </div>
      </div>

      {/* Score bar */}
      <ScoreBar score={score.score} maxScore={score.max_score} />

      {/* Quality badge */}
      <div className="flex items-center gap-2 mt-3">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
          score.quality === 'excellent' ? 'bg-emerald/10 text-emerald' :
          score.quality === 'good' ? 'bg-blue-400/10 text-blue-400' :
          score.quality === 'average' ? 'bg-yellow-400/10 text-yellow-400' :
          'bg-red-400/10 text-red-400'
        }`}>
          {score.quality}
        </span>
        <span className="text-xs text-text-muted">{score.summary}</span>
      </div>

      {/* Expand/collapse */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 mt-3 text-xs text-text-muted hover:text-text-secondary transition-colors"
      >
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {expanded ? 'Hide details' : 'Show details'}
      </button>

      {/* Expanded details */}
      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-3 space-y-3 border-t border-border/50 pt-3"
        >
          {/* Strengths */}
          {score.strengths.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs text-emerald mb-2">
                <ThumbsUp className="w-3 h-3" /> Strengths
              </div>
              <ul className="space-y-1">
                {score.strengths.map((s, i) => (
                  <li key={i} className="text-xs text-text-secondary pl-4 relative">
                    <span className="absolute left-0 top-1 text-emerald">•</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Improvements */}
          {score.improvements.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs text-yellow-400 mb-2">
                <Lightbulb className="w-3 h-3" /> Suggested Improvements
              </div>
              <ul className="space-y-1">
                {score.improvements.map((s, i) => (
                  <li key={i} className="text-xs text-text-secondary pl-4 relative">
                    <span className="absolute left-0 top-1 text-yellow-400">•</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Reasoning */}
          <div>
            <div className="flex items-center gap-1.5 text-xs text-text-muted mb-2">
              <ExternalLink className="w-3 h-3" /> Reasoning
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">{score.reasoning}</p>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

interface LLMReviewCardProps {
  reviews: BountyReview[];
}

export function LLMReviewCard({ reviews }: LLMReviewCardProps) {
  if (!reviews || reviews.length === 0) return null;

  return (
    <motion.div variants={fadeIn} initial="initial" animate="animate" className="rounded-xl border border-border bg-forge-900 p-6">
      <h2 className="font-sans text-lg font-semibold text-text-primary mb-6">
        AI Review Results
      </h2>

      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-6">
        {reviews.map((review) => (
          <div key={review.submission_id}>
            {/* Contributor header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-primary">
                  {review.contributor_username}
                </span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  review.passed
                    ? 'bg-emerald/10 text-emerald'
                    : 'bg-red-400/10 text-red-400'
                }`}>
                  {review.passed ? 'Passed' : 'Failed'}
                </span>
              </div>
              <span className="font-mono text-lg font-bold text-text-primary">
                {review.overall_score.toFixed(1)}
                <span className="text-text-muted text-xs font-mono">/10</span>
              </span>
            </div>

            {/* LLM scores grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {review.scores.map((score) => (
                <LLMScoreCard key={score.llm_name} score={score} />
              ))}
            </div>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}