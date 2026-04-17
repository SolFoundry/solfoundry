import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, AlertTriangle, CheckCircle2, TrendingUp } from 'lucide-react';
import type { LLMReview, LLMReviewSummary } from '../../types/bounty';

const MODEL_CONFIG = {
  claude: { name: 'Claude', color: '#D97706', icon: '◆' },
  codex: { name: 'Codex', color: '#10B981', icon: '◈' },
  gemini: { name: 'Gemini', color: '#6366F1', icon: '◇' },
} as const;

const CONSENSUS_CONFIG = {
  strong_approve: { label: 'Strong Approve', color: 'text-emerald', bg: 'bg-emerald/10', icon: CheckCircle2 },
  approve: { label: 'Approve', color: 'text-emerald', bg: 'bg-emerald/10', icon: ThumbsUp },
  mixed: { label: 'Mixed', color: 'text-status-warning', bg: 'bg-status-warning/10', icon: AlertTriangle },
  reject: { label: 'Reject', color: 'text-status-error', bg: 'bg-status-error/10', icon: ThumbsDown },
};

function ScoreBar({ score, max = 10 }: { score: number; max?: number }) {
  const pct = Math.min((score / max) * 100, 100);
  const color = score >= 7 ? 'bg-emerald' : score >= 5 ? 'bg-status-warning' : 'bg-status-error';
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 bg-forge-800 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <span className="font-mono text-sm text-text-primary min-w-[2.5rem] text-right">
        {score.toFixed(1)}
      </span>
    </div>
  );
}

function ReviewCard({ review, expanded, onToggle }: {
  review: LLMReview;
  expanded: boolean;
  onToggle: () => void;
}) {
  const config = MODEL_CONFIG[review.model];
  return (
    <div className="rounded-lg border border-border bg-forge-800/50 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 hover:bg-forge-800 transition-colors text-left"
      >
        <span className="text-lg" style={{ color: config.color }}>{config.icon}</span>
        <span className="font-medium text-sm text-text-primary flex-1">{config.name}</span>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-text-muted">
            {review.confidence}% confidence
          </span>
          <span className="font-mono text-sm font-semibold" style={{ color: config.color }}>
            {review.score.toFixed(1)}/10
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-text-muted" />
          ) : (
            <ChevronDown className="w-4 h-4 text-text-muted" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
              <p className="text-sm text-text-secondary">{review.summary}</p>

              {review.strengths.length > 0 && (
                <div>
                  <p className="text-xs text-emerald font-medium mb-1 flex items-center gap-1">
                    <ThumbsUp className="w-3 h-3" /> Strengths
                  </p>
                  <ul className="space-y-1">
                    {review.strengths.map((s, i) => (
                      <li key={i} className="text-xs text-text-muted pl-3 relative before:content-[\'•\'] before:absolute before:left-0 before:text-emerald">
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {review.improvements.length > 0 && (
                <div>
                  <p className="text-xs text-status-warning font-medium mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Suggested Improvements
                  </p>
                  <ul className="space-y-1">
                    {review.improvements.map((s, i) => (
                      <li key={i} className="text-xs text-text-muted pl-3 relative before:content-[\'•\'] before:absolute before:left-0 before:text-status-warning">
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {review.reasoning && (
                <div>
                  <p className="text-xs text-text-muted font-medium mb-1">Full Reasoning</p>
                  <p className="text-xs text-text-secondary leading-relaxed">{review.reasoning}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface LLMReviewPanelProps {
  summary: LLMReviewSummary;
}

export function LLMReviewPanel({ summary }: LLMReviewPanelProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const consensusConfig = CONSENSUS_CONFIG[summary.consensus];
  const ConsensusIcon = consensusConfig.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-forge-900 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-5 border-b border-border">
        <div className="p-2 rounded-lg bg-forge-800">
          <Brain className="w-5 h-5 text-emerald" />
        </div>
        <div className="flex-1">
          <h2 className="font-sans text-lg font-semibold text-text-primary">LLM Review Results</h2>
          <p className="text-xs text-text-muted">Multi-model AI review pipeline</p>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${consensusConfig.bg}`}>
          <ConsensusIcon className={`w-3.5 h-3.5 ${consensusConfig.color}`} />
          <span className={`text-xs font-medium ${consensusConfig.color}`}>
            {consensusConfig.label}
          </span>
        </div>
      </div>

      {/* Average score + quality indicators */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border">
        <div className="bg-forge-900 p-4 text-center">
          <p className="text-xs text-text-muted mb-1">Average Score</p>
          <p className="font-mono text-2xl font-bold text-emerald">
            {summary.average_score.toFixed(1)}
          </p>
        </div>
        {Object.entries(summary.quality_indicators).map(([key, value]) => (
          <div key={key} className="bg-forge-900 p-4 text-center">
            <p className="text-xs text-text-muted mb-1 capitalize">
              {key.replace(/_/g, ' ')}
            </p>
            <ScoreBar score={value} />
          </div>
        ))}
      </div>

      {/* Individual reviews */}
      <div className="p-4 space-y-2">
        <p className="text-xs text-text-muted font-medium mb-2">Model Reviews</p>
        {summary.reviews.map((review, idx) => (
          <ReviewCard
            key={review.model}
            review={review}
            expanded={expandedIdx === idx}
            onToggle={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
          />
        ))}
      </div>
    </motion.div>
  );
}
